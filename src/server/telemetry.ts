// Opt-in setup progress from the CacheDrop app (mac-cleaner Decision 127, Decision 38): the request
// handler behind api/telemetry. It saves one of three setup events per install ID in Supabase, linked
// to a signup only through the optional per-download code the DMG's URL carried (Decision 39).
// Supabase comes in as a dependency, so Vitest can stand in for it at the boundary (Decision 27).
import { rateLimit, type Guard } from './bot-check.js';
import { json, type Result } from './shared.js';
import { REF } from './tokens.js';

export const EVENTS = ['first_launch', 'first_scan_completed', 'first_cleanup_completed'] as const;
export type SetupEvent = (typeof EVENTS)[number];

/** The slice of the supabase-js client the telemetry endpoint uses. */
export interface TelemetryDb {
  /** true when saved, false when this install ID already sent this event. */
  rpc(
    fn: 'save_telemetry_event',
    args: { p_install_id: string; p_event: SetupEvent; p_app_version: string; p_macos_version: string; p_download_ref?: string },
  ): Result<boolean>;
  rpc(...args: Parameters<Guard['db']['rpc']>): Result<number>;
}

export interface TelemetryDeps {
  db: TelemetryDb;
  /** rateLimitKey(request, env). */
  rateKey: string;
}

export type SetupProgress = { event: SetupEvent; installId: string; appVersion: string; macosVersion: string; downloadRef?: string };

const FIELDS = ['appVersion', 'event', 'installId', 'macosVersion'];
const WITH_REF = ['appVersion', 'downloadRef', 'event', 'installId', 'macosVersion'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const APP_VERSION = /^\d{1,4}(\.\d{1,4}){1,2}$/;
const MACOS_VERSION = /^\d{1,3}(\.\d{1,3}){0,2}$/;

/**
 * The event, or null for anything but exactly the four fields in their formats (Decision 127), plus
 * an optional `downloadRef` in the per-download code's format (Decision 39).
 */
export function parseSetupProgress(body: unknown): SetupProgress | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  const keys = Object.keys(b).sort().join();
  if (keys !== FIELDS.join() && keys !== WITH_REF.join()) return null;
  const { event, installId, appVersion, macosVersion, downloadRef } = b;
  if ('downloadRef' in b && (typeof downloadRef !== 'string' || !REF.test(downloadRef))) return null;
  if (typeof event !== 'string' || !(EVENTS as readonly string[]).includes(event)) return null;
  if (typeof installId !== 'string' || !UUID.test(installId)) return null;
  if (typeof appVersion !== 'string' || !APP_VERSION.test(appVersion)) return null;
  if (typeof macosVersion !== 'string' || !MACOS_VERSION.test(macosVersion)) return null;
  const progress: SetupProgress = { event: event as SetupEvent, installId, appVersion, macosVersion };
  if (typeof downloadRef === 'string') progress.downloadRef = downloadRef;
  return progress;
}

/** A real event is about 150 bytes; nothing larger is read. */
const MAX_BODY_BYTES = 1024;

export async function handleTelemetry(request: Request, deps: TelemetryDeps): Promise<Response> {
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) return json({ error: 'too_large' }, 413);
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return json({ error: 'too_large' }, 413);
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return json({ error: 'invalid' }, 400);
  }
  const body = parseSetupProgress(raw);
  if (!body) return json({ error: 'invalid' }, 400);
  const refused = await rateLimit('telemetry', deps);
  if (refused) return refused;
  const { data, error } = await deps.db.rpc('save_telemetry_event', {
    p_install_id: body.installId,
    p_event: body.event,
    p_app_version: body.appVersion,
    p_macos_version: body.macosVersion,
    // Left out without a code, so this call also works on a database that predates the code (Decision 39).
    ...(body.downloadRef ? { p_download_ref: body.downloadRef } : {}),
  });
  if (error || typeof data !== 'boolean') return json({ error: 'unavailable' }, 503);
  // A repeat of an event this install already sent is answered the same, so the app stops retrying;
  // so is an unknown or expired download code, which just saves the event unlinked.
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
}
