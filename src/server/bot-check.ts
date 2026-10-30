// The bot check and per-IP rate limit in front of both forms (Decision 12): Cloudflare Turnstile's
// siteverify, and the key a request is counted under. The handlers in gate.ts and feedback.ts run
// both through `guard` before anything is saved or sent. The limit itself is counted in Supabase
// (hit_rate_limit), keyed by a keyed hash of the IP: the raw IP is never stored.
import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { isTestDeployment, json, type Env, type Result } from './shared.js';

/** Cloudflare's published test secret keys (developers.cloudflare.com/turnstile/troubleshooting/testing/). */
export const TEST_SECRETS = {
  pass: '1x0000000000000000000000000000000AA',
  fail: '2x0000000000000000000000000000000AA',
  spent: '3x0000000000000000000000000000000AA',
} as const;
/** On a preview with the always-pass key, `fail` or `spent` here swaps in that test key. */
export const TEST_HEADER = 'x-turnstile-test';
/** On a preview with the always-pass key, a test run counts under this instead of its IP. */
export const RATE_KEY_HEADER = 'x-rate-limit-key';

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
/** Tokens are at most 2048 characters (Cloudflare's server-side validation docs). */
export const MAX_TOKEN = 2048;

export type Verdict = 'ok' | 'failed' | 'unavailable';
/** Checks one Turnstile token. */
export type Verify = (token: string, ip: string | null) => Promise<Verdict>;

/**
 * Test mode: a preview or local dev deployment that holds the always-pass test secret. Production
 * holds the real secret, and a deployment without VERCEL_ENV never qualifies.
 */
const testMode = (env: Env) => isTestDeployment(env) && env.TURNSTILE_SECRET_KEY === TEST_SECRETS.pass;

/** The Turnstile check for one request. Anything but a clear yes from Cloudflare is not a pass. */
export function turnstileFor(request: Request, env: Env, fetch: typeof globalThis.fetch): Verify {
  let secret = env.TURNSTILE_SECRET_KEY;
  const asked = request.headers.get(TEST_HEADER);
  if (testMode(env) && (asked === 'fail' || asked === 'spent')) secret = TEST_SECRETS[asked];

  return async (token, ip) => {
    if (!secret) {
      console.error('TURNSTILE_SECRET_KEY is not set');
      return 'unavailable';
    }
    const form = new URLSearchParams({ secret, response: token });
    if (ip) form.set('remoteip', ip);
    try {
      const res = await fetch(SITEVERIFY, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        // Cloudflare's error codes (e.g. invalid-input-secret) name the cause; the secret is never logged.
        const codes = await res.json().then((r: { 'error-codes'?: string[] }) => r['error-codes'] ?? [], () => []);
        throw new Error(`siteverify answered ${res.status}${codes.length ? ` (${codes.join(', ')})` : ''}`);
      }
      const result = (await res.json()) as { success?: boolean; 'error-codes'?: string[] };
      if (result.success === true) return 'ok';
      if (result['error-codes']?.includes('internal-error')) throw new Error('siteverify internal-error');
      return 'failed';
    } catch (e) {
      console.error('Turnstile check unavailable:', (e as Error).message);
      return 'unavailable';
    }
  };
}

/** The client's IP as Vercel reports it (Vercel overwrites both headers), or null locally. */
export function clientIp(request: Request): string | null {
  const real = request.headers.get('x-real-ip')?.trim();
  if (real) return real;
  return request.headers.get('x-forwarded-for')?.split(',')[0].trim() || null;
}

/** The eight 16-bit groups of an IPv6 address, or null. */
function ipv6Groups(ip: string): number[] | null {
  const [head, tail, extra] = ip.split('::');
  if (extra !== undefined) return null;
  const part = (s: string | undefined) => (s ? s.split(':') : []);
  const left = part(head);
  const right = part(tail);
  const last = (tail === undefined ? left : right).at(-1);
  // A dotted IPv4 tail counts as two groups.
  if (last?.includes('.')) {
    const v4 = last.split('.').map(Number);
    const list = tail === undefined ? left : right;
    list.splice(-1, 1, ((v4[0] << 8) | v4[1]).toString(16), ((v4[2] << 8) | v4[3]).toString(16));
  }
  const fill = tail === undefined ? 0 : 8 - left.length - right.length;
  const groups = [...left, ...Array(fill).fill('0'), ...right].map((g) => parseInt(g, 16));
  return groups.length === 8 ? groups : null;
}

/**
 * What one place is: an IPv4 address, or an IPv6 /64 (one home or phone usually gets a whole /64).
 * IPv4-mapped IPv6 addresses count as their IPv4 address.
 */
function place(ip: string): string {
  if (isIP(ip) !== 6) return ip;
  const g = ipv6Groups(ip);
  if (!g) return ip;
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return `${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`;
  return g.slice(0, 4).map((x) => x.toString(16)).join(':') + '::/64';
}

/** A keyed hash of the place an IP is in, so the database never holds an IP (or a guessable hash of one). */
export function ipHash(ip: string, pepper: string): string {
  return createHmac('sha256', pepper).update(`cachedrop rate limit\n${place(ip)}`).digest('hex');
}

/** The key a request is counted under. The pepper is the Supabase service key, which only the functions hold. */
export function rateLimitKey(request: Request, env: Env): string {
  const pepper = env.SUPABASE_SECRET_KEY;
  if (!pepper) throw new Error('SUPABASE_SECRET_KEY must be set');
  const asked = request.headers.get(RATE_KEY_HEADER);
  if (testMode(env) && asked) return ipHash(`test:${asked}`, pepper);
  return ipHash(clientIp(request) ?? 'unknown', pepper);
}

/**
 * Submissions one place may make per window, per form. Signups send an email each (Resend's free
 * plan sends 100 a day) and feedback files a GitHub issue each, so both are low; a person retrying
 * or sending a few notes stays well under them.
 */
export const LIMITS = {
  signup: { limit: 5, windowSeconds: 60 * 60 },
  feedback: { limit: 10, windowSeconds: 60 * 60 },
} as const;
export type Form = keyof typeof LIMITS;

/** What a handler needs to run the guard. The api/ files wire in the real ones. */
export interface Guard {
  db: {
    /** 0 within the limit, or the seconds until the window ends (supabase/migrations/*_rate_limits.sql). */
    rpc(fn: 'hit_rate_limit', args: { p_bucket: Form; p_ip_hash: string; p_limit: number; p_window_seconds: number }): Result<number>;
  };
  verify: Verify;
  /** The client IP, passed on to Turnstile. Never stored. */
  ip: string | null;
  /** rateLimitKey(request, env). */
  rateKey: string;
}

/**
 * The bot check, then the rate limit, for one submission of `form`: a refusal to send back, or
 * null to go ahead. Call it after the body is parsed and before anything is saved or sent.
 * Only submissions that pass Turnstile are counted.
 */
export async function guard(form: Form, token: unknown, deps: Guard): Promise<Response | null> {
  if (typeof token !== 'string' || !token || token.length > MAX_TOKEN) return json({ error: 'bot_check' }, 403);
  const verdict = await deps.verify(token, deps.ip);
  if (verdict === 'failed') return json({ error: 'bot_check' }, 403);
  if (verdict === 'unavailable') return json({ error: 'unavailable' }, 503);

  const { limit, windowSeconds } = LIMITS[form];
  const { data, error } = await deps.db.rpc('hit_rate_limit', {
    p_bucket: form,
    p_ip_hash: deps.rateKey,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error || typeof data !== 'number') return json({ error: 'unavailable' }, 503);
  if (data > 0) return json({ error: 'rate_limited', retryAfter: data }, 429, { 'retry-after': String(data) });
  return null;
}
