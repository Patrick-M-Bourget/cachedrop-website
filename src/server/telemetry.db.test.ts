// The telemetry migration's SQL (supabase/migrations/*_telemetry_events.sql) against the dev Supabase
// project (Decision 38). telemetry.test.ts covers the handler with a stand-in; this checks
// save_telemetry_event, the table's checks, the rate-limit bucket and the 13-month cleanup.
// Skipped unless DB_TESTS=dev, with SUPABASE_URL and SUPABASE_SECRET_KEY set to the dev project
// (never prod), e.g.:
//   DB_TESTS=dev node --env-file=.env.local node_modules/.bin/vitest run src/server/telemetry.db.test.ts
import { randomUUID, createHash, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';
import { handleTelemetry, type TelemetryDb } from './telemetry.ts';

const { DB_TESTS, SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
const run = DB_TESTS === 'dev' && !!SUPABASE_URL && !!SUPABASE_SECRET_KEY;
const db = run ? createClient(SUPABASE_URL!, SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } }) : null!;
const installs: string[] = [];
const hashes: string[] = [];
const newInstall = () => {
  const id = randomUUID();
  installs.push(id);
  return id;
};

const save = (install: string, event = 'first_launch', app = '0.9.6', macos = '26.1') =>
  db.rpc('save_telemetry_event', { p_install_id: install, p_event: event, p_app_version: app, p_macos_version: macos });

afterAll(async () => {
  if (run && installs.length) await db.from('telemetry_events').delete().in('install_id', installs);
  if (run && hashes.length) await db.from('rate_limits').delete().in('ip_hash', hashes);
});

describe.skipIf(!run)('telemetry on the dev database', () => {
  it('saves an event once per install ID, answering true then false', async () => {
    const id = newInstall();
    expect((await save(id)).data).toBe(true);
    expect((await save(id)).data).toBe(false);
    expect((await save(id, 'first_scan_completed')).data).toBe(true);
    const { data } = await db.from('telemetry_events').select('install_id, event, app_version, macos_version').eq('install_id', id).order('id');
    expect(data).toEqual([
      { install_id: id, event: 'first_launch', app_version: '0.9.6', macos_version: '26.1' },
      { install_id: id, event: 'first_scan_completed', app_version: '0.9.6', macos_version: '26.1' },
    ]);
  });

  it('refuses unknown events and versions with text in them', async () => {
    expect((await save(newInstall(), 'opened_settings')).error).not.toBeNull();
    expect((await save(newInstall(), 'first_launch', '0.9.6 beta')).error).not.toBeNull();
    expect((await save(newInstall(), 'first_launch', '0.9.6', 'Version 26.1')).error).not.toBeNull();
  });

  it('accepts the telemetry rate-limit bucket', async () => {
    const h = createHash('sha256').update(randomBytes(32)).digest('hex');
    hashes.push(h);
    const { data, error } = await db.rpc('hit_rate_limit', { p_bucket: 'telemetry', p_ip_hash: h, p_limit: 30, p_window_seconds: 3600 });
    expect(error).toBeNull();
    expect(data).toBe(0);
  });

  it('deletes only events older than 13 months', async () => {
    const old = newInstall();
    const recent = newInstall();
    await save(old);
    await save(recent);
    const { error } = await db.from('telemetry_events').update({ received_at: new Date(Date.now() - 400 * 86400_000).toISOString() }).eq('install_id', old);
    expect(error).toBeNull();
    const cleaned = await db.rpc('delete_old_telemetry_events');
    expect(cleaned.error).toBeNull();
    expect(cleaned.data).toBeGreaterThanOrEqual(1);
    const { data } = await db.from('telemetry_events').select('install_id').in('install_id', [old, recent]);
    expect(data).toEqual([{ install_id: recent }]);
  });

  it('serves a request end to end: 204, saved once, 400 for an extra field', async () => {
    const id = newInstall();
    const key = createHash('sha256').update(randomBytes(32)).digest('hex');
    hashes.push(key);
    const deps = { db: db as unknown as TelemetryDb, rateKey: key };
    const request = (body: unknown) =>
      new Request('https://dev.example/api/telemetry', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const event = { event: 'first_cleanup_completed', installId: id, appVersion: '0.9.6', macosVersion: '26.1' };
    expect((await handleTelemetry(request(event), deps)).status).toBe(204);
    expect((await handleTelemetry(request(event), deps)).status).toBe(204);
    expect((await handleTelemetry(request({ ...event, sizeBytes: 1 }), deps)).status).toBe(400);
    expect((await handleTelemetry(request({ ...event, event: 'opened_settings' }), deps)).status).toBe(400);
    expect((await handleTelemetry(request({ ...event, appVersion: '0.9.6 beta' }), deps)).status).toBe(400);
    const { data } = await db.from('telemetry_events').select('event').eq('install_id', id);
    expect(data).toEqual([{ event: 'first_cleanup_completed' }]);
  });

  it('answers 429 once one place has sent 30 events in the hour', async () => {
    const key = createHash('sha256').update(randomBytes(32)).digest('hex');
    hashes.push(key);
    const deps = { db: db as unknown as TelemetryDb, rateKey: key };
    const send = () =>
      handleTelemetry(
        new Request('https://dev.example/api/telemetry', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ event: 'first_launch', installId: newInstall(), appVersion: '0.9.6', macosVersion: '26.1' }),
        }),
        deps,
      );
    for (let i = 0; i < 30; i++) expect((await send()).status).toBe(204);
    const refused = await send();
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get('retry-after'))).toBeGreaterThan(0);
  }, 60_000);
});
