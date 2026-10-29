import { describe, expect, it } from 'vitest';
import { mailerFor, siteUrlFrom } from './mail.ts';

const EMAIL = { to: 'ada@example.com', subject: 'Your CacheDrop download link', text: 'text', html: '<p>html</p>' };

function fakeResend(status = 200) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetch = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init! });
    return new Response(JSON.stringify(status === 200 ? { id: 'em_1' } : { message: 'nope' }), { status });
  };
  return { calls, fetch: fetch as typeof globalThis.fetch };
}

const req = (headers: Record<string, string> = {}) => new Request('https://x.test/api/signup', { method: 'POST', headers });
const CAPTURE = { 'x-capture-email': '1' };

describe('mailerFor', () => {
  it('sends through Resend from hello@cachedrop.io', async () => {
    const resend = fakeResend();
    const send = mailerFor(req(), { RESEND_API_KEY: 're_test', VERCEL_ENV: 'production' }, resend.fetch);
    expect(await send(EMAIL)).toBeUndefined();
    expect(resend.calls).toHaveLength(1);
    const { url, init } = resend.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer re_test');
    expect(JSON.parse(init.body as string)).toEqual({
      from: 'CacheDrop <hello@cachedrop.io>',
      to: ['ada@example.com'],
      subject: EMAIL.subject,
      text: EMAIL.text,
      html: EMAIL.html,
    });
  });

  it('passes the email\'s headers, such as List-Unsubscribe, to Resend', async () => {
    const resend = fakeResend();
    const headers = { 'List-Unsubscribe': '<https://cachedrop.io/api/unsubscribe?token=t>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' };
    await mailerFor(req(), { RESEND_API_KEY: 're_test' }, resend.fetch)({ ...EMAIL, headers });
    expect(JSON.parse(resend.calls[0].init.body as string).headers).toEqual(headers);
  });

  it('throws when Resend refuses, so the signup can report it', async () => {
    const send = mailerFor(req(), { RESEND_API_KEY: 're_test' }, fakeResend(422).fetch);
    await expect(send(EMAIL)).rejects.toThrow(/422/);
  });

  it('throws when no Resend key is set', async () => {
    const resend = fakeResend();
    await expect(mailerFor(req(), {}, resend.fetch)(EMAIL)).rejects.toThrow(/RESEND_API_KEY/);
    expect(resend.calls).toEqual([]);
  });

  it('on a preview with CAPTURE_EMAIL=1, returns the email instead of sending it when the request asks', async () => {
    const resend = fakeResend();
    const env = { RESEND_API_KEY: 're_test', VERCEL_ENV: 'preview', CAPTURE_EMAIL: '1' };
    expect(await mailerFor(req(CAPTURE), env, resend.fetch)(EMAIL)).toEqual(EMAIL);
    expect(resend.calls).toEqual([]);
  });

  it('on that preview, still sends when the request does not ask, so people testing by hand get the email', async () => {
    const resend = fakeResend();
    const env = { RESEND_API_KEY: 're_test', VERCEL_ENV: 'preview', CAPTURE_EMAIL: '1' };
    expect(await mailerFor(req(), env, resend.fetch)(EMAIL)).toBeUndefined();
    expect(resend.calls).toHaveLength(1);
  });

  it('never captures without CAPTURE_EMAIL=1', async () => {
    const resend = fakeResend();
    await mailerFor(req(CAPTURE), { RESEND_API_KEY: 're_test', VERCEL_ENV: 'preview' }, resend.fetch)(EMAIL);
    expect(resend.calls).toHaveLength(1);
  });

  it('never captures in production, even with CAPTURE_EMAIL=1', async () => {
    const resend = fakeResend();
    const env = { RESEND_API_KEY: 're_test', VERCEL_ENV: 'production', CAPTURE_EMAIL: '1' };
    expect(await mailerFor(req(CAPTURE), env, resend.fetch)(EMAIL)).toBeUndefined();
    expect(resend.calls).toHaveLength(1);
  });
});

describe('siteUrlFrom', () => {
  it('links production emails to the production domain', () => {
    expect(siteUrlFrom({ VERCEL_ENV: 'production', VERCEL_PROJECT_PRODUCTION_URL: 'cachedrop.io', VERCEL_URL: 'x-abc.vercel.app' })).toBe(
      'https://cachedrop.io',
    );
  });

  it('links preview emails to the branch preview', () => {
    expect(siteUrlFrom({ VERCEL_ENV: 'preview', VERCEL_BRANCH_URL: 'site-git-t8.vercel.app', VERCEL_URL: 'site-abc.vercel.app' })).toBe(
      'https://site-git-t8.vercel.app',
    );
    expect(siteUrlFrom({ VERCEL_ENV: 'preview', VERCEL_URL: 'site-abc.vercel.app' })).toBe('https://site-abc.vercel.app');
  });

  it('falls back to cachedrop.io outside Vercel', () => {
    expect(siteUrlFrom({})).toBe('https://cachedrop.io');
  });
});
