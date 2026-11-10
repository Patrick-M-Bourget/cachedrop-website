// IndexNow (#136): tell Bing, Yandex, Seznam and Naver which pages were added or changed, instead of waiting
// for their next crawl. Google ignores IndexNow; it reads the sitemap.
//
//   node scripts/indexnow.ts --since <git ref> [--send]   pages new to public/sitemap.xml, or with a new <lastmod>, since <ref>
//   node scripts/indexnow.ts --all [--send]               every page in the sitemap
//
// Without --send it only lists the URLs. Run it after the production deploy is live: it refuses to send until the
// key file serves the key and every URL answers 200. The key is public by design (it proves we own the host).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { DOMParser, type Element } from '@xmldom/xmldom';

export const KEY = '098b9e17e4d47c398fc63b2369792b55';
const HOST = 'cachedrop.io';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const SITEMAP = 'http://www.sitemaps.org/schemas/sitemap/0.9';
const MEANINGS: Record<number, string> = {
  400: 'the request is not valid',
  403: 'the key file was not found or does not hold the key',
  422: 'a URL is not on the host, or the key does not match the protocol',
  429: 'too many requests; submit less often',
};

/** Each page's <loc> mapped to its <lastmod> (empty when it has none), in sitemap order. */
export function sitemapEntries(xml: string) {
  const document = new DOMParser({ onError: () => { throw new Error('The sitemap is not well-formed XML.'); } })
    .parseFromString(xml, 'application/xml');
  const text = (url: Element, name: string) => url.getElementsByTagNameNS(SITEMAP, name)[0]?.textContent?.trim() ?? '';
  return new Map(Array.from(document.getElementsByTagNameNS(SITEMAP, 'url'), (url) => [text(url, 'loc'), text(url, 'lastmod')]));
}

/** Pages in `after` that are missing from `before` or carry a different <lastmod>. */
export function changedUrls(before: string | null, after: string) {
  const old = before === null ? new Map<string, string>() : sitemapEntries(before);
  return [...sitemapEntries(after)].filter(([loc, lastmod]) => old.get(loc) !== lastmod).map(([loc]) => loc);
}

/** What stops a submission: a key file that doesn't serve the key, or a URL that doesn't answer 200. */
export async function checkLive(urls: string[], fetch: typeof globalThis.fetch) {
  const problems: string[] = [];
  const keyFile = await fetch(KEY_LOCATION, { redirect: 'manual' });
  const served = keyFile.ok ? (await keyFile.text()).trim() : '';
  if (served !== KEY) problems.push(`${KEY_LOCATION} answered ${keyFile.status}${keyFile.ok ? ' without the key' : ', not the key'}`);
  for (const url of urls) {
    const { status } = await fetch(url, { redirect: 'manual' });
    if (status !== 200) problems.push(`${url} answered ${status}`);
  }
  return problems;
}

/** Posts the URLs in one request and returns IndexNow's status: 200 accepted, 202 accepted pending the key check. */
export async function submit(urls: string[], fetch: typeof globalThis.fetch) {
  const { status } = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList: urls }),
  });
  if (status !== 200 && status !== 202) throw new Error(`IndexNow answered ${status}: ${MEANINGS[status] ?? 'an unexpected answer'}.`);
  return status;
}

/** The sitemap at a commit, or null when it had none. A ref that names no commit is an error, never "every page is new". */
function sitemapAt(ref: string) {
  const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  try { git('rev-parse', '--verify', `${ref}^{commit}`); } catch { throw new Error(`${ref} is not a commit.`); }
  try { return git('show', `${ref}:public/sitemap.xml`); } catch { return null; }
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const send = args.includes('--send');
  const since = args.indexOf('--since');
  const all = args.includes('--all');
  const rest = args.filter((a, i) => a !== '--send' && a !== '--all' && i !== since && i !== since + 1);
  if (rest.length || all === (since >= 0) || (since >= 0 && !args[since + 1])) {
    console.error('Usage: node scripts/indexnow.ts --since <git ref> | --all  [--send]');
    process.exit(2);
  }
  try {
    const urls = changedUrls(all ? null : sitemapAt(args[since + 1]), readFileSync('public/sitemap.xml', 'utf8'));
    if (!urls.length) { console.log('No pages added or changed.'); process.exit(0); }
    console.log(urls.join('\n'));
    if (!send) { console.log(`\n${urls.length} URL(s). Dry run: add --send to submit them.`); process.exit(0); }
    const problems = await checkLive(urls, fetch);
    if (problems.length) throw new Error(`\nNot sent; is the deploy live?\n  ${problems.join('\n  ')}`);
    console.log(`\nIndexNow answered ${await submit(urls, fetch)} for ${urls.length} URL(s).`);
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }
}
