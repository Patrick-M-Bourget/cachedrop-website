// The download-ref migration's SQL (supabase/migrations/*_download_refs.sql) against the dev Supabase
// project (Decision 39): save_download_ref stores a per-download code against the token's signup,
// save_telemetry_event resolves it to signup_id, deleting a signup deletes its codes and unlinks its
// events, and old codes go after 90 days. Also checks that a signed storage URL still downloads
// with &ref= appended. Skipped unless DB_TESTS=dev, with SUPABASE_URL and SUPABASE_SECRET_KEY set to
// the dev project (never prod), e.g.:
//   DB_TESTS=dev node --env-file=.env.local node_modules/.bin/vitest run src/server/download-refs.db.test.ts
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';
import { BUCKET, handleDownload, type GateDb } from './gate.ts';
import { handleTelemetry, type TelemetryDb } from './telemetry.ts';
import { hashToken, newRef, newToken } from './tokens.ts';

const { DB_TESTS, SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
const run = DB_TESTS === 'dev' && !!SUPABASE_URL && !!SUPABASE_SECRET_KEY;
const DAY = 24 * 60 * 60 * 1000;

const db = run ? createClient(SUPABASE_URL!, SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } }) : null!;
const prefix = `download-refs-db-test+${Date.now()}-${randomBytes(3).toString('hex')}`;
const emails: string[] = [];
const installs: string[] = [];
const rateKeys: string[] = [];

const newInstall = () => {
  const id = randomUUID();
  installs.push(id);
  return id;
};

/** A fresh dev signup with one download token; answers the token's hash and the signup's id. */
async function signup(name: string) {
  const email = `${prefix}-${name}@example.com`;
  emails.push(email);
  const tokenHash = createHash('sha256').update(randomBytes(32)).digest('hex');
  const saved = await db.rpc('request_download', { p_email: email, p_filling: null, p_news: false, p_lang: 'en', p_token_hash: tokenHash });
  expect(saved.error).toBeNull();
  const { data, error } = await db.from('signups').select('id').eq('email', email).single();
  expect(error).toBeNull();
  return { tokenHash, id: data!.id as number };
}

const saveRef = (ref: string, tokenHash: string) => db.rpc('save_download_ref', { p_ref: ref, p_token_hash: tokenHash });

const saveEvent = (install: string, ref?: string | null) =>
  db.rpc('save_telemetry_event', {
    p_install_id: install,
    p_event: 'first_launch',
    p_app_version: '0.9.6',
    p_macos_version: '26.1',
    ...(ref === undefined ? {} : { p_download_ref: ref }),
  });

async function linkedSignup(install: string) {
  const { data, error } = await db.from('telemetry_events').select('signup_id').eq('install_id', install).single();
  expect(error).toBeNull();
  return data!.signup_id as number | null;
}

afterAll(async () => {
  if (run && installs.length) await db.from('telemetry_events').delete().in('install_id', installs);
  if (run && emails.length) await db.from('signups').delete().in('email', emails);
  if (run && rateKeys.length) await db.from('rate_limits').delete().in('ip_hash', rateKeys);
});

describe.skipIf(!run)('download refs on the dev database', () => {
  it('stores a ref against the token\'s signup, and an event sent with it links to that signup', async () => {
    const s = await signup('linked');
    const ref = newRef();
    expect((await saveRef(ref, s.tokenHash)).error).toBeNull();
    const { data } = await db.from('download_refs').select('signup_id').eq('ref', ref).single();
    expect(data).toEqual({ signup_id: s.id });

    const install = newInstall();
    const saved = await saveEvent(install, ref);
    expect(saved.error).toBeNull();
    expect(saved.data).toBe(true);
    expect(await linkedSignup(install)).toBe(s.id);
  });

  it('still saves an event with an unknown ref, or none, without a signup', async () => {
    const unknown = newInstall();
    expect((await saveEvent(unknown, newRef())).data).toBe(true);
    expect(await linkedSignup(unknown)).toBeNull();

    const none = newInstall();
    expect((await saveEvent(none)).data).toBe(true);
    expect(await linkedSignup(none)).toBeNull();

    const explicitNull = newInstall();
    expect((await saveEvent(explicitNull, null)).data).toBe(true);
    expect(await linkedSignup(explicitNull)).toBeNull();
  });

  it('refuses a ref that is not 22 base64url characters', async () => {
    const s = await signup('format');
    expect((await saveRef('too-short', s.tokenHash)).error).not.toBeNull();
    expect((await saveRef(`${newRef()}x`, s.tokenHash)).error).not.toBeNull();
    expect((await saveRef('a'.repeat(21) + '/', s.tokenHash)).error).not.toBeNull();
  });

  it('deleting a signup deletes its refs and unlinks its events, which stay as anonymous counts', async () => {
    const s = await signup('deleted');
    const ref = newRef();
    await saveRef(ref, s.tokenHash);
    const install = newInstall();
    await saveEvent(install, ref);
    expect(await linkedSignup(install)).toBe(s.id);

    const { error } = await db.from('signups').delete().eq('id', s.id);
    expect(error).toBeNull();
    const refs = await db.from('download_refs').select('ref').eq('signup_id', s.id);
    expect(refs.data).toEqual([]);
    expect(await linkedSignup(install)).toBeNull();
  });

  it('deletes only refs older than 90 days, and an older ref no longer links', async () => {
    const s = await signup('cleanup');
    const old = newRef();
    const recent = newRef();
    await saveRef(old, s.tokenHash);
    await saveRef(recent, s.tokenHash);
    const aged = await db.from('download_refs').update({ created_at: new Date(Date.now() - 91 * DAY).toISOString() }).eq('ref', old);
    expect(aged.error).toBeNull();

    const install = newInstall();
    await saveEvent(install, old);
    expect(await linkedSignup(install)).toBeNull();

    const cleaned = await db.rpc('delete_old_download_refs');
    expect(cleaned.error).toBeNull();
    expect(cleaned.data).toBeGreaterThanOrEqual(1);
    const { data } = await db.from('download_refs').select('ref').in('ref', [old, recent]);
    expect(data).toEqual([{ ref: recent }]);
  });

  it('a signed storage URL with &ref= appended still downloads the DMG', async () => {
    const { data: latest, error } = await db.from('releases').select('filename').eq('is_latest', true).maybeSingle();
    expect(error).toBeNull();
    expect(latest, 'dev needs a latest release to sign').not.toBeNull();
    const signed = await db.storage.from(BUCKET).createSignedUrl(latest!.filename, 60, { download: latest!.filename });
    expect(signed.error).toBeNull();
    const res = await fetch(`${signed.data!.signedUrl}&ref=${newRef()}`, { headers: { range: 'bytes=0-15' } });
    expect([200, 206]).toContain(res.status);
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('serves a download end to end: the redirect carries a stored code, and the file still downloads', async () => {
    const email = `${prefix}-e2e@example.com`;
    emails.push(email);
    const token = newToken();
    expect((await db.rpc('request_download', { p_email: email, p_filling: null, p_news: false, p_lang: 'en', p_token_hash: hashToken(token) })).error).toBeNull();
    const { data: s } = await db.from('signups').select('id').eq('email', email).single();
    const { data: before } = await db.from('releases').select('id, download_starts').eq('is_latest', true).single();
    try {
      const deps = { db: db as unknown as GateDb, send: async () => {}, siteUrl: 'https://dev.example' };
      const res = await handleDownload(new Request(`https://dev.example/api/download?token=${token}`), deps);
      expect(res.status).toBe(302);
      const location = res.headers.get('location')!;
      const ref = new URL(location).searchParams.get('ref')!;
      expect(ref).toMatch(/^[A-Za-z0-9_-]{22}$/);
      const { data } = await db.from('download_refs').select('signup_id').eq('ref', ref).single();
      expect(data).toEqual({ signup_id: s!.id });
      const file = await fetch(location, { headers: { range: 'bytes=0-15' } });
      expect([200, 206]).toContain(file.status);
      await file.arrayBuffer();
    } finally {
      // Leave dev's download count as it was.
      await db.from('releases').update({ download_starts: before!.download_starts }).eq('id', before!.id);
    }
  });

  it('links an app event sent to the endpoint with a code, and refuses a malformed code', async () => {
    const s = await signup('endpoint');
    const ref = newRef();
    await saveRef(ref, s.tokenHash);
    const key = createHash('sha256').update(randomBytes(32)).digest('hex');
    rateKeys.push(key);
    const deps = { db: db as unknown as TelemetryDb, rateKey: key };
    const install = newInstall();
    const send = (body: unknown) =>
      handleTelemetry(new Request('https://dev.example/api/telemetry', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), deps);
    const event = { event: 'first_launch', installId: install, appVersion: '0.9.6', macosVersion: '26.1' };
    expect((await send({ ...event, downloadRef: 'not-a-code' })).status).toBe(400);
    expect((await send({ ...event, downloadRef: ref })).status).toBe(204);
    expect(await linkedSignup(install)).toBe(s.id);
    const other = newInstall();
    expect((await send({ ...event, installId: other, downloadRef: newRef() })).status).toBe(204);
    expect(await linkedSignup(other)).toBeNull();
  });
});
