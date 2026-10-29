// The rate limit's SQL (supabase/migrations/*_rate_limits.sql) against the dev Supabase project
// (Decision 12). gate.test.ts and feedback.test.ts cover the handlers with a stand-in; this checks
// hit_rate_limit itself. Skipped unless DB_TESTS=dev, with SUPABASE_URL and SUPABASE_SECRET_KEY
// set to the dev project (never prod), e.g.:
//   DB_TESTS=dev node --env-file=.env.local node_modules/.bin/vitest run src/server/rate-limit.db.test.ts
import { createHash, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';

const { DB_TESTS, SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
const run = DB_TESTS === 'dev' && !!SUPABASE_URL && !!SUPABASE_SECRET_KEY;
const db = run ? createClient(SUPABASE_URL!, SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } }) : null!;
const hashes: string[] = [];
const newHash = () => {
  const h = createHash('sha256').update(randomBytes(32)).digest('hex');
  hashes.push(h);
  return h;
};

const hit = async (bucket: string, hash: string, limit: number, windowSeconds = 3600) => {
  const { data, error } = await db.rpc('hit_rate_limit', { p_bucket: bucket, p_ip_hash: hash, p_limit: limit, p_window_seconds: windowSeconds });
  expect(error).toBeNull();
  return data as number;
};

afterAll(async () => {
  if (run && hashes.length) await db.from('rate_limits').delete().in('ip_hash', hashes);
});

describe.skipIf(!run)('hit_rate_limit on the dev database', () => {
  it('allows up to the limit, then answers the seconds left in the window', async () => {
    const h = newHash();
    expect([await hit('signup', h, 3), await hit('signup', h, 3), await hit('signup', h, 3)]).toEqual([0, 0, 0]);
    const wait = await hit('signup', h, 3);
    expect(wait).toBeGreaterThan(0);
    expect(wait).toBeLessThanOrEqual(3600);
  });

  it('counts each form and each place separately', async () => {
    const a = newHash();
    const b = newHash();
    expect(await hit('signup', a, 1)).toBe(0);
    expect(await hit('signup', a, 1)).toBeGreaterThan(0);
    expect(await hit('feedback', a, 1)).toBe(0);
    expect(await hit('signup', b, 1)).toBe(0);
  });

  it('stores only the hash it was given', async () => {
    const h = newHash();
    await hit('feedback', h, 5);
    const { data, error } = await db.from('rate_limits').select('*').eq('ip_hash', h);
    expect(error).toBeNull();
    expect(data).toEqual([{ bucket: 'feedback', ip_hash: h, window_start: expect.any(String), hits: 1 }]);
  });

  it('refuses anything that is not a known form and a hex hash', async () => {
    const bad = await db.rpc('hit_rate_limit', { p_bucket: 'signup', p_ip_hash: '203.0.113.7', p_limit: 5, p_window_seconds: 3600 });
    expect(bad.error).not.toBeNull();
    const form = await db.rpc('hit_rate_limit', { p_bucket: 'other', p_ip_hash: newHash(), p_limit: 5, p_window_seconds: 3600 });
    expect(form.error).not.toBeNull();
  });
});
