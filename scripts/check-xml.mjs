// Sitemap check of the built site. Search Console rejects the whole sitemap over one bad tag
// (a missing </url> stayed live for a week after #121), so dist/sitemap.xml must:
//  1. parse as XML, and
//  2. be a <urlset> whose children are all <url>, each with exactly one <loc> and at most one <lastmod>.
import { readFile } from 'node:fs/promises';
import { DOMParser } from '@xmldom/xmldom';

const SITEMAP = 'http://www.sitemaps.org/schemas/sitemap/0.9';
const file = process.argv[2] ?? 'dist/sitemap.xml';
const problems = [];

let document;
try {
  document = new DOMParser({ onError: (level, message) => { throw new Error(`${level}: ${message}`); } })
    .parseFromString(await readFile(file, 'utf8'), 'application/xml');
} catch (error) {
  console.error(`${file} is not well-formed XML: ${error.message}`);
  process.exit(1);
}

const root = document.documentElement;
if (root?.namespaceURI !== SITEMAP || root.localName !== 'urlset') problems.push('the root is not a sitemap <urlset>');
const children = root ? [...root.childNodes].filter((n) => n.nodeType === 1) : [];
for (const node of children) {
  if (node.namespaceURI !== SITEMAP || node.localName !== 'url') { problems.push(`<urlset> holds a <${node.tagName}>`); continue; }
  const count = (name) => [...node.childNodes].filter((n) => n.nodeType === 1 && n.namespaceURI === SITEMAP && n.localName === name).length;
  const loc = node.getElementsByTagNameNS(SITEMAP, 'loc')[0]?.textContent ?? '(no loc)';
  if (count('loc') !== 1) problems.push(`${loc}: ${count('loc')} <loc> tags`);
  if (count('lastmod') > 1) problems.push(`${loc}: ${count('lastmod')} <lastmod> tags`);
  if (count('url') > 0) problems.push(`${loc}: a <url> nested inside it`);
}

if (problems.length) {
  console.error(`${file}:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`${file}: ${children.length} <url> entries, well-formed.`);
