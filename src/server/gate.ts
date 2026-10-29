// The email gate (Decisions 1, 2, 14): the request handlers behind api/signup, api/release and
// api/download. Supabase and the mail sender come in as dependencies, so Vitest can stand in for
// both at the boundary (Decision 27). The api/ files wire in the real ones.
import { guard, type Guard } from './bot-check.js';
import { downloadEmail, pagesFor } from './download-email.js';
import { TOKEN, hashToken, newToken } from './tokens.js';
import { unsubscribeFor } from './unsubscribe.js';

export const BUCKET = 'releases';
/** How long a signed DMG URL works (Decision 2). */
export const SIGNED_URL_SECONDS = 60;
/** The "What's filling your Mac?" answers, as the form posts them. */
export const FILLING = ['development', 'video-photo', 'music-audio', 'other'] as const;
/** The site's languages (Decision 5): English at /, French at /fr/. */
export const LANGS = ['en', 'fr'] as const;
export type Lang = (typeof LANGS)[number];

type Result<T> = Promise<{ data: T | null; error: { message: string } | null }>;
export type TokenLookup = { status: 'ok' | 'unknown' | 'expired' | 'no_release'; version: string | null; filename: string | null };

/** The slice of the supabase-js client the gate uses. */
export interface GateDb {
  rpc(fn: 'request_download', args: { p_email: string; p_filling: string | null; p_news: boolean; p_lang: Lang; p_token_hash: string }): Result<unknown>;
  rpc(fn: 'download_for_token', args: { p_token_hash: string; p_count: boolean }): Result<TokenLookup[]>;
  rpc(fn: 'issue_unsubscribe_token', args: { p_email: string; p_token_hash: string }): Result<unknown>;
  /** true when the token was known (and its address is now unsubscribed). */
  rpc(fn: 'unsubscribe', args: { p_token_hash: string }): Result<boolean>;
  rpc(...args: Parameters<Guard['db']['rpc']>): Result<number>;
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
  /** Extra headers, e.g. List-Unsubscribe. */
  headers?: Record<string, string>;
}

export interface GateDeps {
  db: GateDb;
  /** Sends the email. In capture mode it returns the email instead of sending it. */
  send(email: Email): Promise<Email | void>;
  /** Origin the emailed link points at, e.g. https://cachedrop.io. */
  siteUrl: string;
}

/** The signup also runs the bot check and rate limit (Decision 12). */
export type SignupDeps = GateDeps & Guard;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

// One @, something on each side, a dot in the domain, no spaces. The emailed link is the real check.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/signup with JSON `{ email, filling?, news?, lang?, turnstile }`: saves the signup (or
 * finds the one for this email) and emails a new download link. Only `news: true` counts as the
 * news opt-in, and a later request without it never turns an existing yes off (Decision 3). `lang`
 * is the page's language, "en" unless it is exactly "fr"; the latest request's language is stored
 * and the email goes out in it (Decision 5). The Turnstile token and the rate limit are checked
 * first (Decision 12).
 */
export async function handleSignup(request: Request, deps: SignupDeps): Promise<Response> {
  let body: { email?: unknown; filling?: unknown; news?: unknown; lang?: unknown; turnstile?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (email.length > 254 || !EMAIL.test(email)) return json({ error: 'invalid_email' }, 400);
  const filling = FILLING.find((f) => f === body.filling) ?? null;
  const lang: Lang = body.lang === 'fr' ? 'fr' : 'en';
  const refused = await guard('signup', body.turnstile, deps);
  if (refused) return refused;

  const token = newToken();
  const saved = await deps.db.rpc('request_download', {
    p_email: email,
    p_filling: filling,
    p_news: body.news === true,
    p_lang: lang,
    p_token_hash: hashToken(token),
  });
  if (saved.error) return json({ error: 'unavailable' }, 503);
  const unsubscribe = newToken();
  const issued = await deps.db.rpc('issue_unsubscribe_token', { p_email: email, p_token_hash: hashToken(unsubscribe) });
  if (issued.error) return json({ error: 'unavailable' }, 503);

  let captured: Email | void;
  try {
    const link = `${pagesFor(deps.siteUrl, lang)}/download/${token}/`;
    captured = await deps.send(downloadEmail(email, lang, link, deps.siteUrl, unsubscribeFor(deps.siteUrl, unsubscribe, lang)));
  } catch (e) {
    console.error('download email failed:', (e as Error).message);
    return json({ error: 'email_failed' }, 502);
  }
  return json(captured ? { ok: true, captured } : { ok: true });
}

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
