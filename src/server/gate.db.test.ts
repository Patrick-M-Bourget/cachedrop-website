// The email gate's SQL (supabase/migrations) against the dev Supabase project: the opt-in rules in
// request_download, the signup language, the token cleanup job, and unsubscribe with re-consent (Decisions 2, 3, 4, 32). gate.test.ts covers the handlers
// with a stand-in database; this checks the real functions behave the same way.
// Skipped unless DB_TESTS=dev, with SUPABASE_URL and SUPABASE_SECRET_KEY set to the dev project
// (never prod), e.g.:
//   DB_TESTS=dev node --env-file=.env.local node_modules/.bin/vitest run src/server/gate.db.test.ts
import { createHash, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';

const { DB_TESTS, SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
const run = DB_TESTS === 'dev' && !!SUPABASE_URL && !!SUPABASE_SECRET_KEY;
const DAY = 24 * 60 * 60 * 1000;

const db = run ? createClient(SUPABASE_URL!, SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } }) : null!;
const prefix = `gate-db-test+${Date.now()}-${randomBytes(3).toString('hex')}`;
const emails: string[] = [];

const newEmail = (name: string) => {
  const email = `${prefix}-${name}@example.com`;
  emails.push(email);
  return email;
};
const newHash = () => createHash('sha256').update(randomBytes(32)).digest('hex');

async function request(email: string, news: boolean) {
  const { error } = await db.rpc('request_download', { p_email: email, p_filling: null, p_news: news, p_token_hash: newHash() });
  expect(error).toBeNull();
}

async function requestIn(email: string, lang: 'en' | 'fr' | null, news = false) {
  const { error } = await db.rpc('request_download', { p_email: email, p_filling: null, p_news: news, p_lang: lang, p_token_hash: newHash() });
  expect(error).toBeNull();
}

async function langOf(email: string) {
  const { data, error } = await db.from('signups').select('lang').eq('email', email).single();
  expect(error).toBeNull();
  return data!.lang;
}

async function signup(email: string) {
  const { data, error } = await db.from('signups').select('id, news_opt_in, news_opt_in_at').eq('email', email).single();
  expect(error).toBeNull();
  return data!;
}

afterAll(async () => {
  if (run && emails.length) await db.from('signups').delete().in('email', emails);
});

describe.skipIf(!run)('request_download on the dev database', () => {
  it('records a yes with its time, a no without one, and a later yes', async () => {
    const yes = newEmail('yes');
    const before = Date.now() - 60_000;
    await request(yes, true);
    const y = await signup(yes);
    expect(y.news_opt_in).toBe(true);
    expect(Date.parse(y.news_opt_in_at)).toBeGreaterThan(before);

    const no = newEmail('no');
    await request(no, false);
    expect(await signup(no)).toMatchObject({ news_opt_in: false, news_opt_in_at: null });

    await request(no, true);
    const later = await signup(no);
    expect(later.news_opt_in).toBe(true);
    expect(later.news_opt_in_at).not.toBeNull();
  });

  it('keeps one signup per email and never turns a yes off', async () => {
    const email = newEmail('keep');
    await request(email, true);
    const first = await signup(email);
    await request(email, false);
    await request(email, true);
    const after = await signup(email);
    expect(after).toEqual(first);
    const { count } = await db.from('download_tokens').select('*', { count: 'exact', head: true }).eq('signup_id', first.id);
    expect(count).toBe(3);
  });
});

describe.skipIf(!run)('signup language on the dev database (Decision 5)', () => {
  it('stores the language, and a later request in the other language switches it', async () => {
    const email = newEmail('lang');
    await requestIn(email, 'fr');
    expect(await langOf(email)).toBe('fr');
    await requestIn(email, 'en');
    expect(await langOf(email)).toBe('en');
    await requestIn(email, 'fr');
    expect(await langOf(email)).toBe('fr');
  });

  it('switching language keeps the opt-in rules: no tick never turns a yes off', async () => {
    const email = newEmail('langnews');
    await requestIn(email, 'en', true);
    const first = await signup(email);
    await requestIn(email, 'fr', false);
    expect(await signup(email)).toEqual(first);
    expect(await langOf(email)).toBe('fr');
  });

  it('refuses a language other than en or fr', async () => {
    const email = newEmail('langbad');
    const { error } = await db.rpc('request_download', { p_email: email, p_filling: null, p_news: false, p_lang: 'de', p_token_hash: newHash() });
    expect(error).not.toBeNull();
  });

  it('the older calls without a language store English and never change a stored language', async () => {
    const email = newEmail('langold');
    await request(email, false);
    expect(await langOf(email)).toBe('en');
    await requestIn(email, 'fr');
    await request(email, true);
    expect(await langOf(email)).toBe('fr');
    const { error } = await db.rpc('request_download', { p_email: email, p_filling: null, p_token_hash: newHash() });
    expect(error).toBeNull();
    expect(await langOf(email)).toBe('fr');
  });
});

describe.skipIf(!run)('the token cleanup job on the dev database', () => {
  it('deletes tokens more than 30 days past expiry and nothing else', async () => {
    const email = newEmail('cleanup');
    await request(email, true);
    const { id } = await signup(email);
    const now = Date.now();
    const tokens = {
      gone: now - 31 * DAY,
      expiredRecently: now - 29 * DAY,
      expiredToday: now - 1000,
      live: now + 6 * DAY,
    };
    const hashes = Object.fromEntries(Object.keys(tokens).map((k) => [k, newHash()]));
    const { error } = await db.from('download_tokens').insert(
      Object.entries(tokens).map(([k, expires]) => ({
        token_hash: hashes[k],
        signup_id: id,
        created_at: new Date(expires - 7 * DAY).toISOString(),
        expires_at: new Date(expires).toISOString(),
      })),
    );
    expect(error).toBeNull();

    const cleaned = await db.rpc('delete_expired_tokens');
    expect(cleaned.error).toBeNull();
    expect(cleaned.data).toBeGreaterThanOrEqual(1);

    const { data: left } = await db.from('download_tokens').select('token_hash').eq('signup_id', id);
    const remaining = new Set(left!.map((t) => t.token_hash));
    expect(remaining.has(hashes.gone)).toBe(false);
    for (const k of ['expiredRecently', 'expiredToday', 'live']) expect(remaining.has(hashes[k])).toBe(true);
    // The token from the signup request itself is untouched too, and so is the signup.
    expect(remaining.size).toBe(4);
    expect(await signup(email)).toMatchObject({ id, news_opt_in: true });
  });
});

async function unsubscribe(email: string) {
  const hash = newHash();
  expect((await db.rpc('issue_unsubscribe_token', { p_email: email, p_token_hash: hash })).error).toBeNull();
  const { data, error } = await db.rpc('unsubscribe', { p_token_hash: hash });
  expect(error).toBeNull();
  expect(data).toBe(true);
}

async function subscribed(email: string) {
  const { data, error } = await db.rpc('subscribed_signups').eq('email', email);
  expect(error).toBeNull();
  return data!.length === 1;
}

async function row(email: string) {
  const { data, error } = await db.from('signups').select('email, filling, news_opt_in, news_opt_in_at, unsubscribed_at').eq('email', email).single();
  expect(error).toBeNull();
  return data!;
}

describe.skipIf(!run)('unsubscribe and re-consent on the dev database', () => {
  it('keeps only the address after an unsubscribe: the news opt-in goes with the rest', async () => {
    const email = newEmail('unsub');
    const { error } = await db.rpc('request_download', { p_email: email, p_filling: 'development', p_news: true, p_token_hash: newHash() });
    expect(error).toBeNull();
    await unsubscribe(email);
    const r = await row(email);
    expect(r).toMatchObject({ email, filling: null, news_opt_in: false, news_opt_in_at: null });
    expect(r.unsubscribed_at).not.toBeNull();
    expect(await subscribed(email)).toBe(false);
  });

  it('a fresh tick on a later request clears the unsubscribe, so emails resume', async () => {
    const email = newEmail('reconsent');
    await request(email, true);
    await unsubscribe(email);
    const before = Date.now() - 60_000;
    await request(email, true);
    const r = await row(email);
    expect(r.unsubscribed_at).toBeNull();
    expect(r.news_opt_in).toBe(true);
    expect(Date.parse(r.news_opt_in_at!)).toBeGreaterThan(before);
    expect(await subscribed(email)).toBe(true);
  });

  it('a later request without the tick keeps the person unsubscribed', async () => {
    const email = newEmail('staysout');
    await request(email, true);
    await unsubscribe(email);
    await request(email, false);
    const r = await row(email);
    expect(r.unsubscribed_at).not.toBeNull();
    expect(r).toMatchObject({ news_opt_in: false, news_opt_in_at: null });
    expect(await subscribed(email)).toBe(false);
    // The three-argument wrapper older previews call never opts in, so it never re-consents either.
    const { error } = await db.rpc('request_download', { p_email: email, p_filling: null, p_token_hash: newHash() });
    expect(error).toBeNull();
    expect(await subscribed(email)).toBe(false);
  });
});
