import { describe, expect, it } from 'vitest';
import { issuesFor } from './github.ts';

const DRAFT = { title: 'Happy: Nice', body: '<!-- cachedrop-feedback:7 -->\n**Rating:** Happy 🙂', labels: ['feedback', 'needs-triage'] };
const PROD = { VERCEL_ENV: 'production', GITHUB_FEEDBACK_TOKEN: 'github_pat_test' };

type Call = { url: string; init: RequestInit };

/** GitHub's REST API at the fetch boundary: answers each call with the next queued response. */
function fakeGitHub(...responses: Array<{ status: number; body: unknown }>) {
  const calls: Call[] = [];
  const fetch = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const next = responses.shift() ?? { status: 500, body: {} };
    return new Response(JSON.stringify(next.body), { status: next.status });
  };
  return { calls, fetch: fetch as typeof globalThis.fetch };
}

describe('issuesFor in production', () => {
  it('files the issue in mac-cleaner with the feedback token, and returns its number', async () => {
    const gh = fakeGitHub({ status: 201, body: { number: 412 } });
    expect(await issuesFor(PROD, gh.fetch).create(DRAFT)).toEqual({ number: 412 });
    expect(gh.calls).toHaveLength(1);
    const { url, init } = gh.calls[0];
    expect(url).toBe('https://api.github.com/repos/Patrick-M-Bourget/mac-cleaner/issues');
    expect(init.method).toBe('POST');
    const headers = new Headers(init.headers);
    expect(headers.get('authorization')).toBe('Bearer github_pat_test');
    expect(headers.get('accept')).toBe('application/vnd.github+json');
    expect(JSON.parse(init.body as string)).toEqual(DRAFT);
  });

  it('throws when GitHub refuses, so the row waits for the retry', async () => {
    const gh = fakeGitHub({ status: 403, body: { message: 'Resource not accessible' } });
    await expect(issuesFor(PROD, gh.fetch).create(DRAFT)).rejects.toThrow(/403/);
  });

  it('throws without calling GitHub when no token is set', async () => {
    const gh = fakeGitHub();
    await expect(issuesFor({ VERCEL_ENV: 'production' }, gh.fetch).create(DRAFT)).rejects.toThrow(/GITHUB_FEEDBACK_TOKEN/);
    expect(gh.calls).toEqual([]);
  });

  it('finds an issue already filed for a feedback row by its marker, among feedback issues since the row', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({ number: i + 1, body: `<!-- cachedrop-feedback:${1000 + i} -->` }));
    const gh = fakeGitHub({ status: 200, body: page1 }, { status: 200, body: [{ number: 300, body: DRAFT.body }, { number: 301, body: null }] });
    expect(await issuesFor(PROD, gh.fetch).findByFeedbackId(7, '2026-10-29T12:00:00.000Z')).toBe(300);
    const url = new URL(gh.calls[0].url);
    expect(url.pathname).toBe('/repos/Patrick-M-Bourget/mac-cleaner/issues');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      labels: 'feedback',
      state: 'all',
      since: '2026-10-29T11:59:00.000Z',
      per_page: '100',
      page: '1',
    });
    expect(new URL(gh.calls[1].url).searchParams.get('page')).toBe('2');
  });

  it('does not mistake feedback 7 for feedback 70', async () => {
    const gh = fakeGitHub({ status: 200, body: [{ number: 5, body: '<!-- cachedrop-feedback:70 -->' }] });
    expect(await issuesFor(PROD, gh.fetch).findByFeedbackId(7, '2026-10-29T12:00:00.000Z')).toBeNull();
  });

  it('throws when the lookup fails, so the retry files nothing it might duplicate', async () => {
    const gh = fakeGitHub({ status: 502, body: {} });
    await expect(issuesFor(PROD, gh.fetch).findByFeedbackId(7, '2026-10-29T12:00:00.000Z')).rejects.toThrow(/502/);
  });
});

describe('issuesFor outside production (test mode)', () => {
  it.each([['preview'], ['development'], [undefined]])('on %s, never calls GitHub and returns the draft', async (env) => {
    const gh = fakeGitHub();
    const issues = issuesFor({ VERCEL_ENV: env, GITHUB_FEEDBACK_TOKEN: 'github_pat_test' }, gh.fetch);
    expect(await issues.create(DRAFT)).toEqual({ captured: DRAFT });
    expect(await issues.findByFeedbackId(7, '2026-10-29T12:00:00.000Z')).toBeNull();
    expect(gh.calls).toEqual([]);
  });
});
