// The real boundaries behind the license handlers, in plain fetch and Web Crypto so the function
// needs no imports: Supabase's PostgREST rpc endpoint, Resend's REST API (Decision 14), Cloudflare
// Turnstile's siteverify, and the keyed IP hash the rate limit counts (Decision 12). These mirror
// src/server/mail.ts and src/server/bot-check.ts, which use Node APIs the Edge Function can't share.
import type { Email } from './email.ts';
import type { LicenseDb, Send, Verdict } from './handlers.ts';

export const FROM = 'CacheDrop <hello@cachedrop.io>';

/** rpc() against `${url}/rest/v1/rpc/<fn>` with the service role key, as supabase-js sends it. */
export function restDb(url: string, serviceKey: string, fetchFn: typeof fetch = fetch): LicenseDb {
  const rpc = async (fn: string, args: Record<string, unknown>) => {
    try {
      const res = await fetchFn(`${url}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' },
        body: JSON.stringify(args),
      });
      if (!res.ok) return { data: null, error: { message: `${fn} answered ${res.status}` } };
      return { data: await res.json(), error: null };
    } catch (e) {
      return { data: null, error: { message: `${fn} failed: ${(e as Error).message}` } };
    }
  };
  return { rpc } as LicenseDb;
}

/** Sends through Resend; throws unless Resend accepts the email. */
export function resendSender(apiKey: string, fetchFn: typeof fetch = fetch): Send {
  return async (email: Email, idempotencyKey?: string) => {
    if (!apiKey) throw new Error('RESEND_API_KEY is not set');
    const headers: Record<string, string> = { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' };
    if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;
    const res = await fetchFn('https://api.resend.com/emails', {
      method: 'POST',
      headers,
      body: JSON.stringify({ from: FROM, to: [email.to], subject: email.subject, text: email.text, html: email.html }),
    });
    if (!res.ok) throw new Error(`Resend answered ${res.status}`);
  };
}

/** Cloudflare Turnstile's siteverify. Anything but a clear yes is not a pass. */
export function turnstile(secret: string, fetchFn: typeof fetch = fetch) {
  return async (token: string, ip: string | null): Promise<Verdict> => {
    if (!secret) {
      console.error('TURNSTILE_SECRET_KEY is not set');
      return 'unavailable';
    }
    const form = new URLSearchParams({ secret, response: token });
    if (ip) form.set('remoteip', ip);
    try {
      const res = await fetchFn('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`siteverify answered ${res.status}`);
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

/** The client's IP from the first X-Forwarded-For entry, or null. */
export function clientIp(request: Request): string | null {
  return request.headers.get('x-forwarded-for')?.split(',')[0].trim() || null;
}

/**
 * One place, as the download form counts it: an IPv4 address, or an IPv6 /64 (IPv4-mapped IPv6
 * counts as its IPv4 address).
 */
export function place(ip: string): string {
  if (!ip.includes(':')) return ip;
  const [head, tail, extra] = ip.toLowerCase().split('::');
  if (extra !== undefined) return ip;
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const last = (tail === undefined ? left : right).at(-1) ?? '';
  if (last.includes('.')) {
    const v4 = last;
    const groups = [...left, ...right].slice(0, -1);
    if (groups.length >= 1 && groups.at(-1) === 'ffff' && groups.slice(0, -1).every((g) => /^0+$/.test(g))) return v4;
    return ip;
  }
  const fill = tail === undefined ? 0 : 8 - left.length - right.length;
  const groups = [...left, ...Array(Math.max(0, fill)).fill('0'), ...right].map((g) => parseInt(g, 16));
  if (groups.length !== 8 || groups.some((g) => Number.isNaN(g))) return ip;
  return `${groups.slice(0, 4).map((g) => g.toString(16)).join(':')}::/64`;
}

/** A keyed SHA-256 HMAC of the place, so the database never holds an IP or a guessable hash of one. */
export async function ipHash(ip: string, pepper: string): Promise<string> {
  if (!pepper) throw new Error('The rate-limit pepper must be set');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`cachedrop rate limit\n${place(ip)}`)));
  return Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * CORS headers for "resend my key" when a page on one of `origins` calls it from the browser, or
 * none. `origins` is the SITE_ORIGINS secret: comma-separated, https://cachedrop.io by default.
 */
export function corsHeaders(origin: string | null, origins = 'https://cachedrop.io'): Record<string, string> {
  const allowed = origins.split(',').map((o) => o.trim()).filter(Boolean);
  if (!origin || !allowed.includes(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
}
