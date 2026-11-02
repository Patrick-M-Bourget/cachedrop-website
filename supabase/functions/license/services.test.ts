// The license function's real boundaries with fetch stood in for, and its IP hash against the
// download form's (src/server/bot-check.ts), so both count a place the same way.
import { describe, expect, it } from 'vitest';
import { ipHash as siteIpHash } from '../../../src/server/bot-check.ts';
import { clientIp, corsHeaders, dbKey, ipHash, resendSender, restDb, turnstile } from './services.ts';

function fakeFetch(status: number, body: unknown) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchFn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { fetchFn, calls };
}

describe('ipHash', () => {
  it('hashes a place exactly as the download form does', async () => {
    for (const ip of ['203.0.113.7', '2001:db8:1:2:3:4:5:6', '2001:db8:1:2::9', '::ffff:198.51.100.4', '::1', 'unknown']) {
      expect(await ipHash(ip, 'pepper')).toBe(siteIpHash(ip, 'pepper'));
    }
  });

  it('counts one IPv6 /64 as one place', async () => {
    expect(await ipHash('2001:db8:1:2::1', 'p')).toBe(await ipHash('2001:db8:1:2:ffff::9', 'p'));
    expect(await ipHash('2001:db8:1:2::1', 'p')).not.toBe(await ipHash('2001:db8:1:3::1', 'p'));
  });

  it('takes the first X-Forwarded-For entry', () => {
    expect(clientIp(new Request('https://x', { headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' } }))).toBe('203.0.113.7');
    expect(clientIp(new Request('https://x'))).toBeNull();
  });
});

describe('restDb', () => {
  it('posts the arguments to the rpc endpoint with the service key', async () => {
    const { fetchFn, calls } = fakeFetch(200, true);
    const result = await restDb('https://ref.supabase.co', 'service-key', fetchFn).rpc('mark_license_emailed', { p_id: 'x' });
    expect(result).toEqual({ data: true, error: null });
    expect(calls[0].url).toBe('https://ref.supabase.co/rest/v1/rpc/mark_license_emailed');
    expect(calls[0].init.headers).toMatchObject({ apikey: 'service-key', authorization: 'Bearer service-key' });
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ p_id: 'x' });
  });

  it('sends a new-style secret key (sb_secret_…) as apikey only, never as a Bearer token (#76)', async () => {
    const { fetchFn, calls } = fakeFetch(200, true);
    await restDb('https://ref.supabase.co', 'sb_secret_abc', fetchFn).rpc('mark_license_emailed', { p_id: 'x' });
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.apikey).toBe('sb_secret_abc');
    expect(headers.authorization).toBeUndefined();
  });

  it('turns an error status into an error', async () => {
    const { fetchFn } = fakeFetch(500, { message: 'boom' });
    const result = await restDb('https://ref.supabase.co', 'k', fetchFn).rpc('mark_license_emailed', { p_id: 'x' });
    expect(result.data).toBeNull();
    expect(result.error?.message).toMatch(/500/);
  });
});

describe('dbKey (#76)', () => {
  it('prefers LICENSE_DB_SECRET_KEY, then the injected legacy service role key', () => {
    const env = (vars: Record<string, string>) => (name: string) => vars[name] ?? '';
    expect(dbKey(env({ LICENSE_DB_SECRET_KEY: 'sb_secret_new', SUPABASE_SERVICE_ROLE_KEY: 'legacy' }))).toBe('sb_secret_new');
    expect(dbKey(env({ SUPABASE_SERVICE_ROLE_KEY: 'legacy' }))).toBe('legacy');
    expect(dbKey(env({}))).toBe('');
  });
});

describe('resendSender', () => {
  const email = { to: 'a@example.com', subject: 's', text: 't', html: 'h' };

  it('sends from hello@cachedrop.io with the idempotency key', async () => {
    const { fetchFn, calls } = fakeFetch(200, { id: 'e1' });
    await resendSender('re_key', fetchFn)(email, 'license-1');
    expect(calls[0].url).toBe('https://api.resend.com/emails');
    expect(calls[0].init.headers).toMatchObject({ authorization: 'Bearer re_key', 'idempotency-key': 'license-1' });
    expect(JSON.parse(calls[0].init.body as string)).toMatchObject({ from: 'CacheDrop <hello@cachedrop.io>', to: ['a@example.com'] });
  });

  it('throws unless Resend accepts', async () => {
    await expect(resendSender('re_key', fakeFetch(422, {}).fetchFn)(email)).rejects.toThrow(/422/);
    await expect(resendSender('', fakeFetch(200, {}).fetchFn)(email)).rejects.toThrow(/RESEND_API_KEY/);
  });
});

describe('turnstile', () => {
  it('passes only a clear yes', async () => {
    expect(await turnstile('s', fakeFetch(200, { success: true }).fetchFn)('t', null)).toBe('ok');
    expect(await turnstile('s', fakeFetch(200, { success: false }).fetchFn)('t', null)).toBe('failed');
    expect(await turnstile('s', fakeFetch(500, {}).fetchFn)('t', null)).toBe('unavailable');
    expect(await turnstile('', fakeFetch(200, { success: true }).fetchFn)('t', null)).toBe('unavailable');
  });
});

describe('corsHeaders', () => {
  it('allows only the listed origins', () => {
    expect(corsHeaders('https://cachedrop.io')['access-control-allow-origin']).toBe('https://cachedrop.io');
    expect(corsHeaders('https://evil.example')).toEqual({});
    expect(corsHeaders(null)).toEqual({});
    expect(corsHeaders('https://preview.vercel.app', 'https://cachedrop.io, https://preview.vercel.app')['access-control-allow-origin']).toBe('https://preview.vercel.app');
  });
});
