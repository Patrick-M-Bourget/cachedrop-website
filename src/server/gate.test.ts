import { describe, expect, it } from 'vitest';
import { handleDownload, handleRelease, handleSignup, type Email, type GateDb } from './gate.ts';
import { handleUnsubscribe } from './unsubscribe.ts';
import { KEY, PASS, WAIT, fakeRateLimit, fakeTurnstile } from './bot-check.fakes.ts';
import { LIMITS } from './bot-check.ts';

const SITE = 'https://preview.example.vercel.app';
const DAY = 24 * 60 * 60 * 1000;

type Release = { id: number; version: string; filename: string; is_latest: boolean; download_starts: number };

// An in-memory stand-in for the slice of supabase-js the functions use, behaving like the
// email-gate migration: one signup per email, tokens stored as hashes that expire after 7 days,
// and download_for_token counting starts on the latest release.
function fakeSupabase(releases: Release[] = [{ id: 1, version: '1.2.0', filename: 'CacheDrop-1.2.0.dmg', is_latest: true, download_starts: 0 }]) {
  const signups: Array<{ id: number; email: string; filling: string | null; news: boolean; newsAt: number | null; lang: string; unsubscribed?: boolean }> = [];
  const tokens = new Map<string, { signupId: number; expiresAt: number }>();
  const unsubscribeTokens = new Map<string, number>();
  const signed: Array<{ path: string; expiresIn: number; download: unknown }> = [];
  const limits = fakeRateLimit();
  const state = { signups, tokens, unsubscribeTokens, releases, signed, limits, now: Date.now(), fail: false };
  const db: GateDb = {
    async rpc(fn: string, args: Record<string, unknown>) {
      if (state.fail) return { data: null, error: { message: 'connection reset' } };
      if (fn === 'hit_rate_limit') return limits.rpc(args as Parameters<typeof limits.rpc>[0]);
      if (fn === 'request_download') {
        const { p_email, p_filling, p_token_hash, p_news, p_lang } = args as { p_email: string; p_filling: string | null; p_token_hash: string; p_news: boolean; p_lang: string };
        if (p_email !== p_email.toLowerCase()) return { data: null, error: { message: 'check constraint' } };
        if (!/^[0-9a-f]{64}$/.test(p_token_hash)) return { data: null, error: { message: 'check constraint' } };
        if (typeof p_news !== 'boolean') return { data: null, error: { message: 'function request_download does not exist' } };
        if (p_lang !== 'en' && p_lang !== 'fr') return { data: null, error: { message: 'check constraint' } };
        let s = signups.find((x) => x.email === p_email);
        if (!s) signups.push((s = { id: signups.length + 1, email: p_email, filling: p_filling, news: false, newsAt: null, lang: p_lang }));
        // The latest request's language wins: later emails go out in it (Decision 5, #14). An
        // unsubscribed marker keeps its own unless the request ticks the box (Decision 32).
        if (!s.unsubscribed || p_news) s.lang = p_lang;
        // A tick turns the opt-in on; no tick never turns it off (Decision 3). A tick is also fresh
        // consent after an unsubscribe (Decision 32).
        if (p_news && !s.news) Object.assign(s, { news: true, newsAt: state.now });
        if (p_news) delete s.unsubscribed;
        tokens.set(p_token_hash, { signupId: s.id, expiresAt: state.now + 7 * DAY });
        return { data: null, error: null };
      }
      if (fn === 'download_for_token') {
        const { p_token_hash, p_count } = args as { p_token_hash: string; p_count: boolean };
        const t = tokens.get(p_token_hash);
        const none = { version: null, filename: null };
        if (!t) return { data: [{ status: 'unknown', ...none }], error: null };
        if (t.expiresAt <= state.now) return { data: [{ status: 'expired', ...none }], error: null };
        const latest = releases.find((r) => r.is_latest);
        if (!latest) return { data: [{ status: 'no_release', ...none }], error: null };
        if (p_count) latest.download_starts++;
        return { data: [{ status: 'ok', version: latest.version, filename: latest.filename }], error: null };
      }
      if (fn === 'issue_unsubscribe_token') {
        const { p_email, p_token_hash } = args as { p_email: string; p_token_hash: string };
        const s = signups.find((x) => x.email === p_email);
        if (!s || !/^[0-9a-f]{64}$/.test(p_token_hash)) return { data: null, error: { message: 'no signup' } };
        unsubscribeTokens.set(p_token_hash, s.id);
        return { data: null, error: null };
      }
      if (fn === 'unsubscribe') {
        const id = unsubscribeTokens.get((args as { p_token_hash: string }).p_token_hash);
        const s = signups.find((x) => x.id === id);
        // Only the address stays marked (Decision 32): the opt-in and the language go with it (Decision 34).
        if (s) Object.assign(s, { unsubscribed: true, news: false, newsAt: null, lang: 'en' });
        return { data: !!s, error: null };
      }
      throw new Error(`unexpected rpc ${fn}`);
    },
    storage: {
      from(bucket: string) {
        if (bucket !== 'releases') throw new Error(`unexpected bucket ${bucket}`);
        return {
          async createSignedUrl(path: string, expiresIn: number, opts?: { download?: string | boolean }) {
            signed.push({ path, expiresIn, download: opts?.download });
            return { data: { signedUrl: `https://ref.supabase.co/storage/v1/object/sign/releases/${path}?token=sig${signed.length}` }, error: null };
          },
        };
      },
    },
  } as GateDb;
  return { db, state };
}

function inbox() {
  const sent: Email[] = [];
  return { sent, send: async (e: Email) => void sent.push(e) };
}

/** A signup request. Objects carry a passing Turnstile token unless they say otherwise. */
const post = (body: unknown, headers: Record<string, string> = { 'content-type': 'application/json' }) =>
  new Request(`${SITE}/api/signup`, {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify({ turnstile: PASS, ...(body as object) }),
  });

function setup(releases?: Release[]) {
  const supabase = fakeSupabase(releases);
  const mail = inbox();
  const turnstile = fakeTurnstile();
  const deps = { db: supabase.db, send: mail.send, siteUrl: SITE, verify: turnstile.verify, ip: '203.0.113.7', rateKey: KEY };
  return { ...supabase, ...mail, turnstile, deps };
}

const linkIn = (email: Email) => email.text.match(/https:\/\/\S+\/download\/([A-Za-z0-9_-]+)\//);

describe('signup', () => {
  it('saves the signup and emails one download link for a valid email', async () => {
    const { deps, sent, state } = setup();
    const res = await handleSignup(post({ email: 'Ada@Example.com', filling: 'development' }), deps);

    expect(res.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('ada@example.com');
    expect(linkIn(sent[0])?.[0]).toMatch(new RegExp(`^${SITE}/download/[A-Za-z0-9_-]{43}/$`));
    expect(sent[0].html).toContain(linkIn(sent[0])![0]);
    expect(state.signups).toEqual([{ id: 1, email: 'ada@example.com', filling: 'development', news: false, newsAt: null, lang: 'en' }]);
  });

  it('keeps one signup for an email submitted twice and sends a working link each time', async () => {
    const { deps, sent, state } = setup();
    await handleSignup(post({ email: 'ada@example.com' }), deps);
    await handleSignup(post({ email: ' ADA@example.com' }), deps);

    expect(state.signups).toHaveLength(1);
    expect(sent.map((e) => e.to)).toEqual(['ada@example.com', 'ada@example.com']);
    const [a, b] = sent.map((e) => linkIn(e)![1]);
    expect(a).not.toBe(b);
    for (const token of [a, b]) expect((await handleDownload(get(`/api/download?token=${token}`), deps)).status).toBe(302);
  });

  it.each([['not-an-email'], ['ada@example'], ['a b@example.com'], [''], [42], [`${'a'.repeat(250)}@example.com`]])(
    'refuses %j without saving or sending anything',
    async (email) => {
      const { deps, sent, state } = setup();
      const res = await handleSignup(post({ email }), deps);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'invalid_email' });
      expect(sent).toEqual([]);
      expect(state.signups).toEqual([]);
    },
  );

  it('refuses a body that is not JSON', async () => {
    const { deps, sent } = setup();
    expect((await handleSignup(post('email=ada@example.com'), deps)).status).toBe(400);
    expect(sent).toEqual([]);
  });

  it('saves no answer when "What\'s filling your Mac?" is skipped or unknown', async () => {
    const { deps, state } = setup();
    await handleSignup(post({ email: 'ada@example.com' }), deps);
    await handleSignup(post({ email: 'bob@example.com', filling: 'gaming' }), deps);
    expect(state.signups.map((s) => s.filling)).toEqual([null, null]);
  });

  it('sends a transactional email: the link, what CacheDrop is, the sender and the privacy policy', async () => {
    const { deps, sent } = setup();
    await handleSignup(post({ email: 'ada@example.com' }), deps);
    const [email] = sent;
    expect(email.subject).toBe('Your CacheDrop download link');
    for (const part of [email.text, email.html]) {
      expect(part).toContain('CacheDrop is a Mac storage cleaner');
      expect(part).toContain('hello@cachedrop.io');
      expect(part).toContain(`${SITE}/privacy/`);
      expect(part).toContain('The link works for 7 days, on any Mac.');
      expect(part).toContain('CacheDrop itself doesn’t expire.');
      expect(part).not.toContain('It works for 7 days');
    }
  });

  it('gives each request its own link, and never stores the token itself', async () => {
    const { deps, sent, state } = setup();
    await handleSignup(post({ email: 'ada@example.com' }), deps);
    await handleSignup(post({ email: 'bob@example.com' }), deps);
    const [a, b] = sent.map((e) => linkIn(e)![1]);
    expect(a).not.toBe(b);
    expect([...state.tokens.keys()]).not.toContain(a);
    expect(state.tokens.size).toBe(2);
  });

  it('sends nothing and says so when the database is unavailable', async () => {
    const { deps, sent, state } = setup();
    state.fail = true;
    const res = await handleSignup(post({ email: 'ada@example.com' }), deps);
    expect(res.status).toBe(503);
    expect(sent).toEqual([]);
  });

  it('says so when the email could not be sent, so the person can try again', async () => {
    const { deps } = setup();
    const res = await handleSignup(post({ email: 'ada@example.com' }), {
      ...deps,
      send: async () => {
        throw new Error('Resend 500');
      },
    });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'email_failed' });
  });

  it('returns the email in the response only when the sender captures it', async () => {
    const { deps } = setup();
    const sending = await (await handleSignup(post({ email: 'ada@example.com' }), deps)).json();
    expect(sending).toEqual({ ok: true });
    const capturing = await (await handleSignup(post({ email: 'ada@example.com' }), { ...deps, send: async (e: Email) => e })).json();
    expect(capturing.captured.to).toBe('ada@example.com');
    expect(capturing.captured.text).toMatch(/\/download\/[A-Za-z0-9_-]{43}\//);
  });
});

describe('bot check and rate limit (Decision 12)', () => {
  it('checks the token with the client IP before saving or sending', async () => {
    const { deps, sent, turnstile } = setup();
    expect((await handleSignup(post({ email: 'ada@example.com' }), deps)).status).toBe(200);
    expect(turnstile.checked).toEqual([{ token: PASS, ip: '203.0.113.7' }]);
    expect(sent).toHaveLength(1);
  });

  it.each([
    ['no token', { turnstile: undefined }],
    ['an empty token', { turnstile: '' }],
    ['a token that is not text', { turnstile: 42 }],
    ['an oversized token', { turnstile: 'x'.repeat(2049) }],
    ['a failing token', { turnstile: 'fail' }],
    ['a token already spent', { turnstile: 'spent' }],
  ])('refuses %s without saving, counting or sending anything', async (_, extra) => {
    const { deps, sent, state } = setup();
    const res = await handleSignup(post({ email: 'ada@example.com', ...extra }), deps);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'bot_check' });
    expect(sent).toEqual([]);
    expect(state.signups).toEqual([]);
    expect(state.limits.hits.size).toBe(0);
  });

  it('says it is unavailable, and saves nothing, when Turnstile cannot answer', async () => {
    const { deps, sent, state } = setup();
    const res = await handleSignup(post({ email: 'ada@example.com', turnstile: 'down' }), deps);
    expect(res.status).toBe(503);
    expect(sent).toEqual([]);
    expect(state.signups).toEqual([]);
  });

  it(`allows ${LIMITS.signup.limit} signups an hour from one place, then refuses with the wait`, async () => {
    const { deps, sent, state } = setup();
    expect(LIMITS.signup).toEqual({ limit: 5, windowSeconds: 3600 });
    for (let i = 0; i < 5; i++) expect((await handleSignup(post({ email: `ada${i}@example.com` }), deps)).status).toBe(200);
    const res = await handleSignup(post({ email: 'bob@example.com' }), deps);
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe(String(WAIT));
    expect(await res.json()).toEqual({ error: 'rate_limited', retryAfter: WAIT });
    expect(sent).toHaveLength(5);
    expect(state.signups.map((s) => s.email)).not.toContain('bob@example.com');
  });

  it('counts each place on its own', async () => {
    const { deps } = setup();
    for (let i = 0; i < 5; i++) await handleSignup(post({ email: `ada${i}@example.com` }), deps);
    expect((await handleSignup(post({ email: 'bob@example.com' }), { ...deps, rateKey: 'b'.repeat(64) })).status).toBe(200);
  });
});

describe('signup language (Decision 5)', () => {
  it('stores the language of the page the signup came from', async () => {
    const { deps, state } = setup();
    await handleSignup(post({ email: 'ada@example.com', lang: 'fr' }), deps);
    await handleSignup(post({ email: 'bob@example.com', lang: 'en' }), deps);
    expect(state.signups.map((s) => [s.email, s.lang])).toEqual([
      ['ada@example.com', 'fr'],
      ['bob@example.com', 'en'],
    ]);
  });

  it.each([[undefined], ['FR'], ['fr-CA'], ['de'], [''], [1], [null], [['fr']]])(
    'falls back to English for lang %j, and still sends the link',
    async (lang) => {
      const { deps, sent, state } = setup();
      const res = await handleSignup(post({ email: 'ada@example.com', lang }), deps);
      expect(res.status).toBe(200);
      expect(state.signups[0].lang).toBe('en');
      expect(sent).toHaveLength(1);
    },
  );

  it('a later signup from the other language switches the stored language to it', async () => {
    const { deps, state } = setup();
    await handleSignup(post({ email: 'ada@example.com', lang: 'en' }), deps);
    await handleSignup(post({ email: 'ada@example.com', lang: 'fr' }), deps);
    expect(state.signups).toHaveLength(1);
    expect(state.signups[0].lang).toBe('fr');
    await handleSignup(post({ email: 'ada@example.com' }), deps);
    expect(state.signups[0].lang).toBe('en');
  });
});

describe('news opt-in (Decision 3)', () => {
  it('records a tick as a yes, with when it was given', async () => {
    const { deps, state } = setup();
    const res = await handleSignup(post({ email: 'ada@example.com', news: true }), deps);
    expect(res.status).toBe(200);
    expect(state.signups[0]).toMatchObject({ news: true, newsAt: state.now });
  });

  it.each([[undefined], [false], ['yes'], [1]])('records no yes when the box is left unticked (news: %j)', async (news) => {
    const { deps, sent, state } = setup();
    await handleSignup(post({ email: 'ada@example.com', news }), deps);
    expect(state.signups[0]).toMatchObject({ news: false, newsAt: null });
    expect(sent).toHaveLength(1);
  });

  it('turns on with a tick on a later visit', async () => {
    const { deps, state } = setup();
    await handleSignup(post({ email: 'ada@example.com' }), deps);
    state.now += DAY;
    await handleSignup(post({ email: 'ada@example.com', news: true }), deps);
    expect(state.signups).toHaveLength(1);
    expect(state.signups[0]).toMatchObject({ news: true, newsAt: state.now });
  });

  it('never turns an existing yes off when a later visit leaves it unticked', async () => {
    const { deps, state } = setup();
    await handleSignup(post({ email: 'ada@example.com', news: true }), deps);
    const givenAt = state.now;
    state.now += DAY;
    await handleSignup(post({ email: 'ada@example.com', news: false }), deps);
    expect(state.signups[0]).toMatchObject({ news: true, newsAt: givenAt });
  });
});

// French emails (Decision 5, #14): the download email, re-sent links and the unsubscribe page
// follow the language the person signed up in.
const tokenLinkIn = (email: Email, base: string) => email.text.match(new RegExp(`${base}/download/([A-Za-z0-9_-]{43})/`));

describe('emails in the signup language (Decision 5)', () => {
  it('a signup from a French page gets the French download email, linking to the French pages', async () => {
    const { deps, sent } = setup();
    await handleSignup(post({ email: 'ada@example.com', lang: 'fr' }), deps);
    const [email] = sent;
    expect(email.subject).toBe('Votre lien de téléchargement CacheDrop');
    expect(email.html).toContain('<html lang="fr">');
    const [link, token] = tokenLinkIn(email, `${SITE}/fr`)!;
    const unsubscribe = email.text.match(new RegExp(`${SITE}/fr/unsubscribe/([A-Za-z0-9_-]{43})/`))!;
    for (const part of [email.text, email.html]) {
      expect(part).toContain(link);
      expect(part).toContain(unsubscribe[0]);
      expect(part).toContain(`${SITE}/fr/privacy/`);
      expect(part).toContain('Le lien fonctionne pendant 7 jours, sur n’importe quel Mac.');
      expect(part).toContain('CacheDrop est un nettoyeur de stockage pour Mac');
      expect(part).toContain('hello@cachedrop.io');
      expect(part).not.toContain('CacheDrop is a Mac storage cleaner');
      expect(part).not.toMatch(new RegExp(`${SITE}/(download|unsubscribe|privacy)/`));
    }
    expect(email.html).toContain('Télécharger CacheDrop');
    expect(email.html).toContain('Se désabonner');
    expect(email.html).toContain('Politique de confidentialité');
    // The link is the same token the API serves; only the page around it is French.
    expect((await handleDownload(get(`/api/download?token=${token}`), deps)).status).toBe(302);
  });

  it('a signup from an English page gets the English email, linking to the English pages', async () => {
    const { deps, sent } = setup();
    await handleSignup(post({ email: 'ada@example.com', lang: 'en' }), deps);
    const [email] = sent;
    expect(email.subject).toBe('Your CacheDrop download link');
    expect(email.html).toContain('<html lang="en">');
    for (const part of [email.text, email.html]) {
      expect(part).not.toContain(`${SITE}/fr/`);
      expect(part).toMatch(new RegExp(`${SITE}/download/[A-Za-z0-9_-]{43}/`));
      expect(part).toMatch(new RegExp(`${SITE}/unsubscribe/[A-Za-z0-9_-]{43}/`));
    }
  });

  it('the French one-click headers unsubscribe, and a GET opens the French page', async () => {
    const { deps, sent, state } = setup();
    await handleSignup(post({ email: 'ada@example.com', lang: 'fr' }), deps);
    const [email] = sent;
    expect(email.headers?.['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    const url = oneClickIn(email)!;
    const [pageUrl, token] = email.text.match(new RegExp(`${SITE}/fr/unsubscribe/([A-Za-z0-9_-]{43})/`))!;
    expect(url).toBe(`${SITE}/api/unsubscribe?token=${token}&lang=fr`);
    const opened = await handleUnsubscribe(get(new URL(url).pathname + new URL(url).search), deps);
    expect(opened.status).toBe(303);
    expect(new URL(opened.headers.get('location')!, SITE).href).toBe(pageUrl);
    expect(state.signups[0].unsubscribed).toBeUndefined();
    expect((await handleUnsubscribe(oneClick(url), deps)).status).toBe(200);
    expect(state.signups[0].unsubscribed).toBe(true);
  });

  it('a GET without a valid token goes to the unsubscribe page in its language', async () => {
    const { deps } = setup();
    const fr = await handleUnsubscribe(get('/api/unsubscribe?token=nope&lang=fr'), deps);
    expect(fr.headers.get('location')).toBe('/fr/unsubscribe/');
    const other = await handleUnsubscribe(get('/api/unsubscribe?token=nope&lang=de'), deps);
    expect(other.headers.get('location')).toBe('/unsubscribe/');
  });

  it('a re-sent link follows a language change: English, then French, then English again', async () => {
    const { deps, sent } = setup();
    await handleSignup(post({ email: 'ada@example.com', lang: 'en' }), deps);
    await handleSignup(post({ email: 'ada@example.com', lang: 'fr' }), deps);
    await handleSignup(post({ email: 'ada@example.com', lang: 'en' }), deps);
    expect(sent.map((e) => e.subject)).toEqual([
      'Your CacheDrop download link',
      'Votre lien de téléchargement CacheDrop',
      'Your CacheDrop download link',
    ]);
    expect(tokenLinkIn(sent[1], `${SITE}/fr`)).not.toBeNull();
    expect(tokenLinkIn(sent[2], SITE)).not.toBeNull();
  });
});

async function signedUp(releases?: Release[]) {
  const s = setup(releases);
  await handleSignup(post({ email: 'ada@example.com' }), s.deps);
  return { ...s, token: linkIn(s.sent[0])![1] };
}

const get = (path: string) => new Request(`${SITE}${path}`);

describe('token page lookup (GET /api/release?token=)', () => {
  it('names the latest release for a valid token without counting a download', async () => {
    const { deps, token, state } = await signedUp();
    const res = await handleRelease(get(`/api/release?token=${token}`), deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ version: '1.2.0', filename: 'CacheDrop-1.2.0.dmg' });
    expect(state.releases[0].download_starts).toBe(0);
  });

  it.each([
    ['an unknown token', 'A'.repeat(43)],
    ['a malformed token', 'not a token'],
    ['no token', ''],
  ])('answers %s with 404', async (_, token) => {
    const { deps } = await signedUp();
    const res = await handleRelease(get(`/api/release?token=${encodeURIComponent(token)}`), deps);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'unknown' });
  });

  it('answers an expired token with 410', async () => {
    const { deps, token, state } = await signedUp();
    state.now += 7 * DAY + 1;
    const res = await handleRelease(get(`/api/release?token=${token}`), deps);
    expect(res.status).toBe(410);
    expect(await res.json()).toEqual({ error: 'expired' });
  });

  it('answers 503 when nothing is published yet', async () => {
    const { deps, token } = await signedUp([]);
    expect((await handleRelease(get(`/api/release?token=${token}`), deps)).status).toBe(503);
  });
});

describe('download start (GET /api/download?token=)', () => {
  it('redirects to a 60-second signed URL for the latest DMG and counts the start', async () => {
    const { deps, token, state } = await signedUp();
    const res = await handleDownload(get(`/api/download?token=${token}`), deps);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toMatch(
      /^https:\/\/ref\.supabase\.co\/storage\/v1\/object\/sign\/releases\/CacheDrop-1\.2\.0\.dmg\?token=/,
    );
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(state.signed).toEqual([{ path: 'CacheDrop-1.2.0.dmg', expiresIn: 60, download: 'CacheDrop-1.2.0.dmg' }]);
    expect(state.releases[0].download_starts).toBe(1);
  });

  it('counts every start, so the retry link counts too, on the latest release only', async () => {
    const { deps, token, state } = await signedUp([
      { id: 1, version: '1.1.0', filename: 'CacheDrop-1.1.0.dmg', is_latest: false, download_starts: 5 },
      { id: 2, version: '1.2.0', filename: 'CacheDrop-1.2.0.dmg', is_latest: true, download_starts: 0 },
    ]);
    await handleDownload(get(`/api/download?token=${token}`), deps);
    await handleDownload(get(`/api/download?token=${token}`), deps);
    expect(state.releases.map((r) => r.download_starts)).toEqual([5, 2]);
  });

  it('gives a fresh signed URL each time', async () => {
    const { deps, token } = await signedUp();
    const a = (await handleDownload(get(`/api/download?token=${token}`), deps)).headers.get('location');
    const b = (await handleDownload(get(`/api/download?token=${token}`), deps)).headers.get('location');
    expect(a).not.toBe(b);
  });

  it.each([
    ['an unknown token', 'A'.repeat(43)],
    ['no token', ''],
  ])('serves no file for %s', async (_, token) => {
    const { deps, state } = await signedUp();
    const res = await handleDownload(get(`/api/download?token=${token}`), deps);
    expect(res.status).toBe(404);
    expect(state.signed).toEqual([]);
  });

  it('serves no file for an expired token', async () => {
    const { deps, token, state } = await signedUp();
    state.now += 7 * DAY + 1;
    const res = await handleDownload(get(`/api/download?token=${token}`), deps);
    expect(res.status).toBe(410);
    expect(state.signed).toEqual([]);
    expect(state.releases[0].download_starts).toBe(0);
  });

  it('still works just before day 7 ends: the token is all it needs, on any Mac', async () => {
    const { deps, token, state } = await signedUp();
    state.now += 7 * DAY - 1000;
    expect((await handleDownload(get(`/api/download?token=${token}`), deps)).status).toBe(302);
  });
});

// Unsubscribe (Decision 4, #10): one link and one-click headers in every email.
const unsubscribeLinkIn = (email: Email) => email.text.match(/https:\/\/\S+\/unsubscribe\/([A-Za-z0-9_-]{43})\//);
const oneClickIn = (email: Email) => email.headers?.['List-Unsubscribe']?.match(/^<(https:\/\/[^>]+)>$/)?.[1];
const oneClick = (url: string, body = 'List-Unsubscribe=One-Click') =>
  new Request(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });

describe('unsubscribe', () => {
  it('puts an unsubscribe link in the download email, and the one-click headers', async () => {
    const { sent } = await signedUp();
    const [email] = sent;
    const link = unsubscribeLinkIn(email);
    expect(link?.[0]).toMatch(new RegExp(`^${SITE}/unsubscribe/[A-Za-z0-9_-]{43}/$`));
    expect(email.html).toContain(`href="${link![0]}"`);
    expect(email.headers?.['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    expect(oneClickIn(email)).toBe(`${SITE}/api/unsubscribe?token=${link![1]}`);
  });

  it('one-click POST from the mail client unsubscribes with an empty 200, and a second POST is harmless', async () => {
    const { deps, sent, state } = await signedUp();
    const url = oneClickIn(sent[0])!;
    const first = await handleUnsubscribe(oneClick(url), deps);
    expect(first.status).toBe(200);
    expect(first.headers.get('location')).toBeNull();
    expect(await first.text()).toBe('');
    expect(state.signups[0].unsubscribed).toBe(true);
    expect((await handleUnsubscribe(oneClick(url), deps)).status).toBe(200);
    expect(state.signups[0].unsubscribed).toBe(true);
  });

  it('the link opens the confirmation page, whose POST unsubscribes', async () => {
    const { deps, sent, state } = await signedUp();
    const [pageUrl, token] = unsubscribeLinkIn(sent[0])!;
    // A GET (a mail client without one-click, or a link scanner) changes nothing; it goes to the page.
    const opened = await handleUnsubscribe(get(`/api/unsubscribe?token=${token}`), deps);
    expect(opened.status).toBe(303);
    expect(new URL(opened.headers.get('location')!, SITE).href).toBe(pageUrl);
    expect(state.signups[0].unsubscribed).toBeUndefined();
    // The page posts the token the way a mail client does.
    expect((await handleUnsubscribe(oneClick(`${SITE}/api/unsubscribe?token=${token}`), deps)).status).toBe(200);
    expect(state.signups[0].unsubscribed).toBe(true);
  });

  it('gives each email its own token, and never stores the token itself', async () => {
    const { deps, sent, state } = await signedUp();
    await handleSignup(post({ email: 'ada@example.com' }), deps);
    const [a, b] = sent.map((e) => unsubscribeLinkIn(e)![1]);
    expect(a).not.toBe(b);
    expect([...state.unsubscribeTokens.keys()]).not.toContain(a);
    expect((await handleUnsubscribe(oneClick(oneClickIn(sent[0])!), deps)).status).toBe(200);
    expect((await handleUnsubscribe(oneClick(oneClickIn(sent[1])!), deps)).status).toBe(200);
  });

  it.each([
    ['a forged token', 'A'.repeat(43)],
    ['the download token', 'download'],
    ['a malformed token', 'not a token'],
    ['no token', ''],
  ])('refuses %s with 404 and unsubscribes nobody', async (_, token) => {
    const { deps, sent, state } = await signedUp();
    const value = token === 'download' ? linkIn(sent[0])![1] : token;
    const res = await handleUnsubscribe(oneClick(`${SITE}/api/unsubscribe?token=${encodeURIComponent(value)}`), deps);
    expect(res.status).toBe(404);
    expect(state.signups[0].unsubscribed).toBeUndefined();
  });

  it('answers 503 when the database is unavailable, so the page can say to try again', async () => {
    const { deps, sent, state } = await signedUp();
    state.fail = true;
    expect((await handleUnsubscribe(oneClick(oneClickIn(sent[0])!), deps)).status).toBe(503);
  });

  it('sends no download email when the unsubscribe token cannot be saved', async () => {
    const { deps, sent } = setup();
    const rpc = deps.db.rpc.bind(deps.db) as (fn: string, args: unknown) => Promise<unknown>;
    const db = {
      ...deps.db,
      rpc: async (fn: string, args: unknown) => (fn === 'issue_unsubscribe_token' ? { data: null, error: { message: 'down' } } : rpc(fn, args)),
    } as unknown as GateDb;
    const res = await handleSignup(post({ email: 'ada@example.com' }), { ...deps, db });
    expect(res.status).toBe(503);
    expect(sent).toEqual([]);
  });
  it('turns the news opt-in off with the unsubscribe (Decision 32: only the address is kept)', async () => {
    const { deps, sent, state } = setup();
    await handleSignup(post({ email: 'ada@example.com', news: true }), deps);
    expect((await handleUnsubscribe(oneClick(oneClickIn(sent[0])!), deps)).status).toBe(200);
    expect(state.signups[0]).toMatchObject({ unsubscribed: true, news: false, newsAt: null });
  });

  it('resets the stored language to English with the unsubscribe (Decision 34)', async () => {
    const { deps, sent, state } = setup();
    await handleSignup(post({ email: 'ada@example.com', lang: 'fr' }), deps);
    expect(state.signups[0].lang).toBe('fr');
    expect((await handleUnsubscribe(oneClick(oneClickIn(sent[0])!), deps)).status).toBe(200);
    expect(state.signups[0]).toMatchObject({ unsubscribed: true, lang: 'en' });
  });

  it('a fresh news tick on a later request clears the unsubscribe (Decision 32)', async () => {
    const { deps, sent, state } = await signedUp();
    await handleUnsubscribe(oneClick(oneClickIn(sent[0])!), deps);
    await handleSignup(post({ email: 'ada@example.com', news: true }), deps);
    expect(state.signups[0]).toMatchObject({ news: true, newsAt: state.now });
    expect(state.signups[0].unsubscribed).toBeUndefined();
  });

  it('a later request without the tick leaves the marker\'s language alone, but its email is in the request\'s language', async () => {
    const { deps, sent, state } = await signedUp();
    await handleUnsubscribe(oneClick(oneClickIn(sent[0])!), deps);
    expect((await handleSignup(post({ email: 'ada@example.com', lang: 'fr' }), deps)).status).toBe(200);
    expect(sent[1].subject).toBe('Votre lien de téléchargement CacheDrop');
    expect(state.signups[0]).toMatchObject({ unsubscribed: true, lang: 'en' });
  });

  it('a later request without the tick keeps the person unsubscribed, and still sends the link', async () => {
    const { deps, sent, state } = await signedUp();
    await handleUnsubscribe(oneClick(oneClickIn(sent[0])!), deps);
    expect((await handleSignup(post({ email: 'ada@example.com' }), deps)).status).toBe(200);
    expect(sent).toHaveLength(2);
    expect(state.signups[0]).toMatchObject({ unsubscribed: true, news: false, newsAt: null });
  });
});
