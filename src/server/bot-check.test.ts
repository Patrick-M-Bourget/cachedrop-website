import { describe, expect, it, vi } from 'vitest';
import { TEST_HEADER, TEST_SECRETS, ipHash, rateLimitKey, turnstileFor } from './bot-check.ts';

const SITE = 'https://preview.example.vercel.app';
const req = (headers: Record<string, string> = {}) => new Request(`${SITE}/api/signup`, { method: 'POST', headers });

/** Cloudflare's siteverify as the client sees it, answering like its test secret keys do. */
function fakeSiteverify(answer?: (secret: string) => Response | Promise<Response>) {
  const calls: URLSearchParams[] = [];
  const fetch = (async (url: string, init: RequestInit) => {
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    const form = new URLSearchParams(init.body as string);
    calls.push(form);
    const secret = form.get('secret')!;
    if (answer) return answer(secret);
    const codes = secret === TEST_SECRETS.pass ? [] : secret === TEST_SECRETS.spent ? ['timeout-or-duplicate'] : ['invalid-input-response'];
    return Response.json({ success: codes.length === 0, 'error-codes': codes });
  }) as typeof globalThis.fetch;
  return { fetch, calls };
}

describe('the Turnstile check', () => {
  it('passes a token Cloudflare accepts, sending the secret, the token and the IP', async () => {
    const cf = fakeSiteverify();
    const verify = turnstileFor(req(), { TURNSTILE_SECRET_KEY: TEST_SECRETS.pass }, cf.fetch);
    expect(await verify('XXXX.DUMMY.TOKEN.XXXX', '203.0.113.7')).toBe('ok');
    expect(Object.fromEntries(cf.calls[0])).toEqual({ secret: TEST_SECRETS.pass, response: 'XXXX.DUMMY.TOKEN.XXXX', remoteip: '203.0.113.7' });
  });

  it.each([
    ['an invalid token (always-fail key)', TEST_SECRETS.fail],
    ['a token already spent', TEST_SECRETS.spent],
  ])('fails %s', async (_, secret) => {
    const verify = turnstileFor(req(), { TURNSTILE_SECRET_KEY: secret }, fakeSiteverify().fetch);
    expect(await verify('XXXX.DUMMY.TOKEN.XXXX', null)).toBe('failed');
  });

  it("logs Cloudflare's error codes, never the secret, when siteverify refuses the request", async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const refused = fakeSiteverify(() => Response.json({ success: false, 'error-codes': ['invalid-input-secret'] }, { status: 400 }));
    const secret = '0x4AAA-real-secret';
    expect(await turnstileFor(req(), { TURNSTILE_SECRET_KEY: secret }, refused.fetch)('t', null)).toBe('unavailable');
    const logged = log.mock.calls.flat().join(' ');
    expect(logged).toContain('invalid-input-secret');
    expect(logged).not.toContain(secret);
    log.mockRestore();
  });

  it('is unavailable, never a pass, when Cloudflare or the secret is missing', async () => {
    const down = fakeSiteverify(() => new Response('bad gateway', { status: 502 }));
    expect(await turnstileFor(req(), { TURNSTILE_SECRET_KEY: TEST_SECRETS.pass }, down.fetch)('t', null)).toBe('unavailable');
    const internal = fakeSiteverify(() => Response.json({ success: false, 'error-codes': ['internal-error'] }));
    expect(await turnstileFor(req(), { TURNSTILE_SECRET_KEY: TEST_SECRETS.pass }, internal.fetch)('t', null)).toBe('unavailable');
    const unset = fakeSiteverify();
    expect(await turnstileFor(req(), {}, unset.fetch)('t', null)).toBe('unavailable');
    expect(unset.calls).toHaveLength(0);
  });

  it('lets a preview test ask for the always-fail or spent key with a header', async () => {
    const cf = fakeSiteverify();
    const env = { TURNSTILE_SECRET_KEY: TEST_SECRETS.pass, VERCEL_ENV: 'preview' };
    expect(await turnstileFor(req({ [TEST_HEADER]: 'fail' }), env, cf.fetch)('t', null)).toBe('failed');
    expect(await turnstileFor(req({ [TEST_HEADER]: 'spent' }), env, cf.fetch)('t', null)).toBe('failed');
    expect(cf.calls.map((c) => c.get('secret'))).toEqual([TEST_SECRETS.fail, TEST_SECRETS.spent]);
  });

  it('ignores that header in production and with a real secret', async () => {
    const cf = fakeSiteverify((secret) => Response.json({ success: secret !== TEST_SECRETS.fail }));
    const header = req({ [TEST_HEADER]: 'fail' });
    expect(await turnstileFor(header, { TURNSTILE_SECRET_KEY: TEST_SECRETS.pass, VERCEL_ENV: 'production' }, cf.fetch)('t', null)).toBe('ok');
    expect(await turnstileFor(header, { TURNSTILE_SECRET_KEY: '0x4AAA-real-secret', VERCEL_ENV: 'preview' }, cf.fetch)('t', null)).toBe('ok');
    expect(cf.calls.map((c) => c.get('secret'))).toEqual([TEST_SECRETS.pass, '0x4AAA-real-secret']);
  });

  it('ignores that header without VERCEL_ENV', async () => {
    const cf = fakeSiteverify();
    expect(await turnstileFor(req({ [TEST_HEADER]: 'fail' }), { TURNSTILE_SECRET_KEY: TEST_SECRETS.pass }, cf.fetch)('t', null)).toBe('ok');
    expect(cf.calls.map((c) => c.get('secret'))).toEqual([TEST_SECRETS.pass]);
  });
});

// The same checks against Cloudflare itself, with its published test secret keys. Skipped offline
// runs fail loudly instead of passing, so set TURNSTILE_LIVE=0 to skip them without a network.
describe.skipIf(process.env.TURNSTILE_LIVE === '0')("Cloudflare's test secret keys", () => {
  const live = (secret: string) => turnstileFor(req(), { TURNSTILE_SECRET_KEY: secret }, fetch)('XXXX.DUMMY.TOKEN.XXXX', '203.0.113.7');
  it('always-pass passes', async () => expect(await live(TEST_SECRETS.pass)).toBe('ok'));
  it('always-fail fails', async () => expect(await live(TEST_SECRETS.fail)).toBe('failed'));
  it('token-already-spent fails', async () => expect(await live(TEST_SECRETS.spent)).toBe('failed'));
});

describe('the rate-limit key', () => {
  const PEPPER = 'service-key';

  it('is a keyed hash of the IP, never the IP', () => {
    const key = rateLimitKey(req({ 'x-real-ip': '203.0.113.7' }), { SUPABASE_SECRET_KEY: PEPPER });
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).toBe(ipHash('203.0.113.7', PEPPER));
    expect(key).not.toBe(ipHash('203.0.113.7', 'another-key'));
    expect(key).not.toBe(ipHash('203.0.113.8', PEPPER));
  });

  it("uses Vercel's x-real-ip, then the first x-forwarded-for entry", () => {
    const env = { SUPABASE_SECRET_KEY: PEPPER };
    expect(rateLimitKey(req({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }), env)).toBe(ipHash('203.0.113.7', PEPPER));
    expect(rateLimitKey(req({ 'x-real-ip': '198.51.100.1', 'x-forwarded-for': '203.0.113.7' }), env)).toBe(ipHash('198.51.100.1', PEPPER));
  });

  it('counts a whole IPv6 /64 as one place, and an IPv4-mapped address as IPv4', () => {
    expect(ipHash('2001:db8:1:2:aaaa::1', PEPPER)).toBe(ipHash('2001:0db8:0001:0002:ffff:ffff:ffff:ffff', PEPPER));
    expect(ipHash('2001:db8:1:2::1', PEPPER)).not.toBe(ipHash('2001:db8:1:3::1', PEPPER));
    expect(ipHash('::ffff:203.0.113.7', PEPPER)).toBe(ipHash('203.0.113.7', PEPPER));
  });

  it('lets a preview test pick its own key, so test runs never share a limit with people', () => {
    const preview = { SUPABASE_SECRET_KEY: PEPPER, TURNSTILE_SECRET_KEY: TEST_SECRETS.pass, VERCEL_ENV: 'preview' };
    const asked = req({ 'x-real-ip': '203.0.113.7', 'x-rate-limit-key': 'journey-123' });
    expect(rateLimitKey(asked, preview)).toBe(ipHash('test:journey-123', PEPPER));
    expect(rateLimitKey(asked, { ...preview, VERCEL_ENV: 'production' })).toBe(ipHash('203.0.113.7', PEPPER));
    expect(rateLimitKey(asked, { ...preview, VERCEL_ENV: undefined })).toBe(ipHash('203.0.113.7', PEPPER));
  });
});
