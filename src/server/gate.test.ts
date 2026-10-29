import { describe, expect, it } from 'vitest';
import { handleDownload, handleRelease, handleSignup, type Email, type GateDb } from './gate.ts';

const SITE = 'https://preview.example.vercel.app';
const DAY = 24 * 60 * 60 * 1000;

type Release = { id: number; version: string; filename: string; is_latest: boolean; download_starts: number };

// An in-memory stand-in for the slice of supabase-js the functions use, behaving like the
// email-gate migration: one signup per email, tokens stored as hashes that expire after 7 days,
// and download_for_token counting starts on the latest release.
function fakeSupabase(releases: Release[] = [{ id: 1, version: '1.2.0', filename: 'CacheDrop-1.2.0.dmg', is_latest: true, download_starts: 0 }]) {
  const signups: Array<{ id: number; email: string; filling: string | null }> = [];
  const tokens = new Map<string, { signupId: number; expiresAt: number }>();
  const signed: Array<{ path: string; expiresIn: number; download: unknown }> = [];
  const state = { signups, tokens, releases, signed, now: Date.now(), fail: false };
  const db: GateDb = {
    async rpc(fn: string, args: Record<string, unknown>) {
      if (state.fail) return { data: null, error: { message: 'connection reset' } };
      if (fn === 'request_download') {
        const { p_email, p_filling, p_token_hash } = args as { p_email: string; p_filling: string | null; p_token_hash: string };
        if (p_email !== p_email.toLowerCase()) return { data: null, error: { message: 'check constraint' } };
        if (!/^[0-9a-f]{64}$/.test(p_token_hash)) return { data: null, error: { message: 'check constraint' } };
        let s = signups.find((x) => x.email === p_email);
        if (!s) signups.push((s = { id: signups.length + 1, email: p_email, filling: p_filling }));
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

const post = (body: unknown, headers: Record<string, string> = { 'content-type': 'application/json' }) =>
  new Request(`${SITE}/api/signup`, { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) });

function setup(releases?: Release[]) {
  const supabase = fakeSupabase(releases);
  const mail = inbox();
  const deps = { db: supabase.db, send: mail.send, siteUrl: SITE };
  return { ...supabase, ...mail, deps };
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
    expect(state.signups).toEqual([{ id: 1, email: 'ada@example.com', filling: 'development' }]);
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
