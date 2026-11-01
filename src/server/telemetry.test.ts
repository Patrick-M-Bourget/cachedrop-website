import { describe, expect, it } from 'vitest';
import { handleTelemetry, type TelemetryDb } from './telemetry.ts';
import { KEY, WAIT, fakeRateLimit } from './bot-check.fakes.ts';
import { LIMITS } from './bot-check.ts';

type Row = { install_id: string; event: string; app_version: string; macos_version: string };

// An in-memory stand-in for the slice of supabase-js the telemetry endpoint uses, behaving like the
// telemetry migration: save_telemetry_event inserts once per install ID and event and answers
// whether it inserted.
function fakeSupabase() {
  const rows: Row[] = [];
  const limits = fakeRateLimit();
  const state = { rows, limits, fail: false };
  const db: TelemetryDb = {
    async rpc(fn: string, args: Record<string, unknown>) {
      if (state.fail) return { data: null, error: { message: 'connection reset' } };
      if (fn === 'hit_rate_limit') return limits.rpc(args as Parameters<typeof limits.rpc>[0]);
      if (fn === 'save_telemetry_event') {
        const a = args as { p_install_id: string; p_event: string; p_app_version: string; p_macos_version: string };
        if (rows.some((r) => r.install_id === a.p_install_id && r.event === a.p_event)) return { data: false, error: null };
        rows.push({ install_id: a.p_install_id, event: a.p_event, app_version: a.p_app_version, macos_version: a.p_macos_version });
        return { data: true, error: null };
      }
      throw new Error(`unexpected rpc ${fn}`);
    },
  } as TelemetryDb;
  return { db, state };
}

const INSTALL = '3f0c6b1e-8a2d-4c7e-9b1a-2d4e6f8a0b1c';
const valid = { event: 'first_launch', installId: INSTALL, appVersion: '0.9.6', macosVersion: '26.1' };

const post = (body: unknown, raw?: string) =>
  new Request('https://cachedrop.io/api/telemetry', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: raw ?? JSON.stringify(body),
  });

describe('POST /api/telemetry', () => {
  it('saves a valid setup event and answers 204', async () => {
    const { db, state } = fakeSupabase();
    const res = await handleTelemetry(post(valid), { db, rateKey: KEY });
    expect(res.status).toBe(204);
    expect(state.rows).toEqual([{ install_id: INSTALL, event: 'first_launch', app_version: '0.9.6', macos_version: '26.1' }]);
  });

  // Decision 127: only the event name, app and macOS versions and the install ID; never anything from disk.
  it.each([
    ['an extra field', { ...valid, path: '/Users/someone/Library/Caches' }],
    ['a missing field', { event: 'first_launch', installId: INSTALL, appVersion: '0.9.6' }],
    ['an unknown event', { ...valid, event: 'opened_settings' }],
    ['an install ID that is not a UUID', { ...valid, installId: 'someone@example.com' }],
    ['an app version with text in it', { ...valid, appVersion: '0.9.6 (Pro trial)' }],
    ['a macOS version with text in it', { ...valid, macosVersion: 'Version 26.1 (Build 25B78)' }],
    ['a value of the wrong type', { ...valid, appVersion: 96 }],
    ['an array', [valid]],
    ['null', null],
  ])('refuses %s with 400 and saves nothing', async (_, body) => {
    const { db, state } = fakeSupabase();
    const res = await handleTelemetry(post(body), { db, rateKey: KEY });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid' });
    expect(state.rows).toEqual([]);
  });

  it('refuses a body that is not JSON', async () => {
    const { db, state } = fakeSupabase();
    const res = await handleTelemetry(post(null, 'event=first_launch'), { db, rateKey: KEY });
    expect(res.status).toBe(400);
    expect(state.rows).toEqual([]);
  });

  it('answers 204 to a repeat of the same install ID and event, and keeps one row', async () => {
    const { db, state } = fakeSupabase();
    await handleTelemetry(post(valid), { db, rateKey: KEY });
    const res = await handleTelemetry(post(valid), { db, rateKey: KEY });
    expect(res.status).toBe(204);
    expect(state.rows).toHaveLength(1);
  });

  it('allows 30 events an hour from one place, then answers 429 with Retry-After', async () => {
    expect(LIMITS.telemetry).toEqual({ limit: 30, windowSeconds: 3600 });
    const { db, state } = fakeSupabase();
    const send = (i: number) =>
      handleTelemetry(post({ ...valid, installId: `3f0c6b1e-8a2d-4c7e-9b1a-${String(i).padStart(12, '0')}` }), { db, rateKey: KEY });
    for (let i = 0; i < 30; i++) expect((await send(i)).status).toBe(204);
    const res = await send(30);
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe(String(WAIT));
    expect(state.rows).toHaveLength(30);
  });

  it('does not count refused bodies against the limit', async () => {
    const { db, state } = fakeSupabase();
    await handleTelemetry(post({ ...valid, event: 'nope' }), { db, rateKey: KEY });
    expect(state.limits.hits.size).toBe(0);
  });

  it('answers 503 when the database is unavailable', async () => {
    const { db, state } = fakeSupabase();
    state.fail = true;
    const res = await handleTelemetry(post(valid), { db, rateKey: KEY });
    expect(res.status).toBe(503);
  });

  it('refuses a body over 1 KB with 413 before parsing it', async () => {
    const { db, state } = fakeSupabase();
    const res = await handleTelemetry(post(null, JSON.stringify({ ...valid, pad: 'x'.repeat(2048) })), { db, rateKey: KEY });
    expect(res.status).toBe(413);
    expect(state.rows).toEqual([]);
    expect(state.limits.hits.size).toBe(0);
  });
});
