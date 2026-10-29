// Stand-ins for the bot check's boundaries in the handler tests (Decision 27): Cloudflare's
// siteverify, and the hit_rate_limit function the rate-limit migration adds to Supabase.
import type { Verdict } from './bot-check.ts';

/** A token the fake Turnstile accepts. */
export const PASS = 'XXXX.DUMMY.TOKEN.XXXX';

/** Turnstile as the handlers see it: PASS passes, 'spent' and anything else fail, 'down' is unavailable. */
export function fakeTurnstile() {
  const checked: Array<{ token: string; ip: string | null }> = [];
  const verify = async (token: string, ip: string | null): Promise<Verdict> => {
    checked.push({ token, ip });
    return token === PASS ? 'ok' : token === 'down' ? 'unavailable' : 'failed';
  };
  return { verify, checked };
}

/** Seconds the fake says are left in a full window. */
export const WAIT = 1800;

/** hit_rate_limit as the migration defines it, in memory: counts per form and key, 0 within the limit. */
export function fakeRateLimit() {
  const hits = new Map<string, number>();
  return {
    hits,
    rpc(args: { p_bucket: string; p_ip_hash: string; p_limit: number; p_window_seconds: number }) {
      if (!/^[0-9a-f]{64}$/.test(args.p_ip_hash)) return { data: null, error: { message: 'check constraint' } };
      const key = `${args.p_bucket}:${args.p_ip_hash}`;
      const n = (hits.get(key) ?? 0) + 1;
      hits.set(key, n);
      return { data: n <= args.p_limit ? 0 : WAIT, error: null };
    },
  };
}

/** A rate-limit key, as rateLimitKey makes them. */
export const KEY = 'a'.repeat(64);
