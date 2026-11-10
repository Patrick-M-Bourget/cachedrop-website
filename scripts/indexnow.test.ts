import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { KEY, changedUrls, checkLive, sitemapEntries, submit } from './indexnow.ts';

const sitemap = (...entries: [string, string][]) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.map(([loc, lastmod]) => `  <url><loc>${loc}</loc><lastmod>${lastmod}</lastmod>
    <xhtml:link rel="alternate" hreflang="en" href="${loc}"/>
  </url>`).join('\n')}
</urlset>`;
const A = 'https://cachedrop.io/';
const B = 'https://cachedrop.io/pricing/';
const C = 'https://cachedrop.io/fr/pricing/';

/** A fetch that answers from a table of URL → [status, body], and records each request. */
function fakeFetch(table: Record<string, [number, string?]>) {
  const requests: { url: string; init?: RequestInit }[] = [];
  const fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    requests.push({ url, init });
    const [status, body] = table[url] ?? [404, ''];
    return new Response(body ?? '', { status });
  };
  return { fetch: fetch as typeof globalThis.fetch, requests };
}

describe('the key file', () => {
  it('is served from public/ and holds the key', () => {
    expect(KEY).toMatch(/^[a-zA-Z0-9-]{8,128}$/);
    expect(readFileSync(`public/${KEY}.txt`, 'utf8').trim()).toBe(KEY);
  });
});

describe('sitemapEntries', () => {
  it('maps each <loc> to its <lastmod>', () => {
    expect(sitemapEntries(sitemap([A, '2026-11-03'], [B, '2026-11-01']))).toEqual(new Map([[A, '2026-11-03'], [B, '2026-11-01']]));
  });

  it('refuses a sitemap that is not well-formed', () => {
    expect(() => sitemapEntries(sitemap([A, '2026-11-03']).replace('</url>', ''))).toThrow(/not well-formed/);
  });
});

describe('changedUrls', () => {
  it('picks new pages and pages whose lastmod changed, in sitemap order', () => {
    const before = sitemap([A, '2026-11-01'], [B, '2026-11-01']);
    const after = sitemap([A, '2026-11-03'], [B, '2026-11-01'], [C, '2026-11-01']);
    expect(changedUrls(before, after)).toEqual([A, C]);
  });

  it('picks every page when there was no sitemap before', () => {
    expect(changedUrls(null, sitemap([A, '2026-11-01'], [B, '2026-11-01']))).toEqual([A, B]);
  });

  it('picks nothing when nothing changed', () => {
    const same = sitemap([A, '2026-11-01']);
    expect(changedUrls(same, same)).toEqual([]);
  });
});

describe('checkLive', () => {
  const keyUrl = `https://cachedrop.io/${KEY}.txt`;

  it('passes when the key file serves the key and every URL answers 200', async () => {
    const { fetch } = fakeFetch({ [keyUrl]: [200, `${KEY}\n`], [A]: [200], [B]: [200] });
    expect(await checkLive([A, B], fetch)).toEqual([]);
  });

  it('names the key file when the deploy with it is not live yet', async () => {
    const { fetch } = fakeFetch({ [A]: [200] });
    expect(await checkLive([A], fetch)).toEqual([`${keyUrl} answered 404, not the key`]);
  });

  it('names each URL that does not answer 200, redirects included', async () => {
    const { fetch, requests } = fakeFetch({ [keyUrl]: [200, KEY], [A]: [200], [B]: [308], [C]: [404] });
    expect(await checkLive([A, B, C], fetch)).toEqual([`${B} answered 308`, `${C} answered 404`]);
    expect(requests.find((r) => r.url === B)?.init?.redirect).toBe('manual');
  });
});

describe('submit', () => {
  const ENDPOINT = 'https://api.indexnow.org/indexnow';

  it('posts the host, key, key location and URLs as JSON', async () => {
    const { fetch, requests } = fakeFetch({ [ENDPOINT]: [202] });
    expect(await submit([A, B], fetch)).toBe(202);
    const [{ init }] = requests;
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('content-type')).toBe('application/json; charset=utf-8');
    expect(JSON.parse(String(init?.body))).toEqual({
      host: 'cachedrop.io', key: KEY, keyLocation: `https://cachedrop.io/${KEY}.txt`, urlList: [A, B],
    });
  });

  it('throws on any answer but 200 or 202, with its meaning', async () => {
    const { fetch } = fakeFetch({ [ENDPOINT]: [403] });
    await expect(submit([A], fetch)).rejects.toThrow('IndexNow answered 403: the key file was not found or does not hold the key.');
  });
});
