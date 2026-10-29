// The email gate (Decisions 1, 2, 14): the request handlers behind api/signup, api/release and
// api/download. Supabase and the mail sender come in as dependencies, so Vitest can stand in for
// both at the boundary (Decision 27). The api/ files wire in the real ones.
import { createHash, randomBytes } from 'node:crypto';
import { downloadEmail } from './download-email.js';

export const BUCKET = 'releases';
/** How long a signed DMG URL works (Decision 2). */
export const SIGNED_URL_SECONDS = 60;
/** The "What's filling your Mac?" answers, as the form posts them. */
export const FILLING = ['development', 'video-photo', 'music-audio', 'other'] as const;

type Result<T> = Promise<{ data: T | null; error: { message: string } | null }>;
export type TokenLookup = { status: 'ok' | 'unknown' | 'expired' | 'no_release'; version: string | null; filename: string | null };

/** The slice of the supabase-js client the gate uses. */
export interface GateDb {
  rpc(fn: 'request_download', args: { p_email: string; p_filling: string | null; p_token_hash: string }): Result<unknown>;
  rpc(fn: 'download_for_token', args: { p_token_hash: string; p_count: boolean }): Result<TokenLookup[]>;
  storage: {
    from(bucket: string): {
      createSignedUrl(path: string, expiresIn: number, opts?: { download?: string | boolean }): Result<{ signedUrl: string }>;
    };
  };
}

export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface GateDeps {
  db: GateDb;
  /** Sends the email. In capture mode it returns the email instead of sending it. */
  send(email: Email): Promise<Email | void>;
  /** Origin the emailed link points at, e.g. https://cachedrop.io. */
  siteUrl: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

// One @, something on each side, a dot in the domain, no spaces. The emailed link is the real check.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** POST /api/signup with JSON `{ email, filling? }`: saves the signup and emails a download link. */
export async function handleSignup(request: Request, deps: GateDeps): Promise<Response> {
  let body: { email?: unknown; filling?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (email.length > 254 || !EMAIL.test(email)) return json({ error: 'invalid_email' }, 400);
  const filling = FILLING.find((f) => f === body.filling) ?? null;

  const token = randomBytes(32).toString('base64url');
  const saved = await deps.db.rpc('request_download', { p_email: email, p_filling: filling, p_token_hash: hashToken(token) });
  if (saved.error) return json({ error: 'unavailable' }, 503);

  let captured: Email | void;
  try {
    captured = await deps.send(downloadEmail(email, `${deps.siteUrl}/download/${token}/`, deps.siteUrl));
  } catch (e) {
    console.error('download email failed:', (e as Error).message);
    return json({ error: 'email_failed' }, 502);
  }
  return json(captured ? { ok: true, captured } : { ok: true });
}

const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const STATUS = { unknown: 404, expired: 410, no_release: 503 } as const;

/** Looks up the request's ?token= and the latest release; `count` records a download start. */
async function lookup(request: Request, db: GateDb, count: boolean) {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  if (!TOKEN.test(token)) return { error: 'unknown', status: 404 } as const;
  const { data, error } = await db.rpc('download_for_token', { p_token_hash: hashToken(token), p_count: count });
  const row = data?.[0];
  if (error || !row) return { error: 'unavailable', status: 503 } as const;
  if (row.status !== 'ok') return { error: row.status, status: STATUS[row.status] } as const;
  return { version: row.version!, filename: row.filename! };
}

/** GET /api/release?token=: the version and filename the token page shows. Counts nothing. */
export async function handleRelease(request: Request, deps: GateDeps): Promise<Response> {
  const found = await lookup(request, deps.db, false);
  if ('error' in found) return json({ error: found.error }, found.status);
  return json(found);
}

/**
 * GET /api/download?token=: counts a download start and redirects to a fresh 60-second signed URL
 * for the latest DMG. The token page and its retry link both go through here.
 */
export async function handleDownload(request: Request, deps: GateDeps): Promise<Response> {
  const found = await lookup(request, deps.db, true);
  if ('error' in found) return json({ error: found.error }, found.status);
  const { data, error } = await deps.db.storage
    .from(BUCKET)
    .createSignedUrl(found.filename, SIGNED_URL_SECONDS, { download: found.filename });
  if (error || !data) return json({ error: 'unavailable' }, 503);
  return new Response(null, { status: 302, headers: { location: data.signedUrl, 'cache-control': 'no-store' } });
}
