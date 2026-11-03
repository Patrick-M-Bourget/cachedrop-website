// JSON-LD check of the built site (Decision 27). Every application/ld+json block in dist/ must:
//  1. be valid JSON-LD (jsonld.expand against the schema.org context, safe mode), and
//  2. use only schema.org terms: every @type is a schema.org class, and every property is a
//     schema.org property whose domain includes the node's type (or one of its superclasses), and
//  3. carry dateModified (#94) on its root or a top-level @graph node, as a YYYY-MM-DD date equal to
//     the page's <lastmod> in the sitemap when the sitemap lists the page.
// The schema.org context and vocabulary are fetched once per run.
import { readFile, readdir } from 'node:fs/promises';
import jsonld from 'jsonld';

const VOCABULARY = 'https://schema.org/version/latest/schemaorg-current-https.jsonld';

const files = (await readdir('dist', { recursive: true })).filter((f) => f.endsWith('.html'));
const sitemap = await readFile('dist/sitemap.xml', 'utf8');
const lastmods = new Map([...sitemap.matchAll(/<loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g)].map(([, loc, date]) => [loc, date]));
/** The page's address on the site, from its file in dist/: `fr/privacy/index.html` is /fr/privacy/. */
const pageUrl = (file) => `https://cachedrop.io/${file.replace(/index\.html$/, '')}`;

function checkDateModified(doc, file) {
  const dates = [doc, ...[doc['@graph'] ?? []].flat()].map((n) => n?.dateModified).filter((d) => d !== undefined);
  if (!dates.length) return ['no dateModified'];
  const problems = dates.filter((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d)).map((d) => `dateModified "${d}" is not YYYY-MM-DD`);
  const lastmod = lastmods.get(pageUrl(file));
  if (lastmod) problems.push(...dates.filter((d) => d !== lastmod).map((d) => `dateModified ${d} is not the sitemap lastmod ${lastmod}`));
  return problems;
}

const contexts = new Map();
const nodeLoader = jsonld.documentLoaders.node();
const documentLoader = async (url) => {
  if (!contexts.has(url)) contexts.set(url, await nodeLoader(url));
  return contexts.get(url);
};

const vocab = (await (await fetch(VOCABULARY)).json())['@graph'];
const ids = (v) => [v ?? []].flat().map((x) => x['@id'].replace(/^schema:/, ''));
const types = (n) => [n['@type']].flat();
const classes = new Map(vocab.filter((n) => types(n).includes('rdfs:Class')).map((n) => [n['rdfs:label'], ids(n['rdfs:subClassOf'])]));
const properties = new Map(vocab.filter((n) => types(n).includes('rdf:Property')).map((n) => [n['rdfs:label'], ids(n['schema:domainIncludes'])]));
const ancestors = (cls, seen = new Set()) => {
  if (seen.has(cls)) return seen;
  seen.add(cls);
  for (const parent of classes.get(cls) ?? []) ancestors(parent, seen);
  return seen;
};

function checkNode(node, where, problems, byId) {
  if (Array.isArray(node)) return node.forEach((n, i) => checkNode(n, `${where}[${i}]`, problems, byId));
  if (!node || typeof node !== 'object') return;
  const nodeTypes = node['@type'] ? [node['@type']].flat() : types(byId.get(node['@id']) ?? {}).filter(Boolean);
  for (const t of nodeTypes) if (!classes.has(t)) problems.push(`${where}: unknown @type "${t}"`);
  const lineage = new Set(nodeTypes.flatMap((t) => [...ancestors(t)]));
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('@')) {
      if (key === '@graph') checkNode(value, `${where}.@graph`, problems, byId);
      continue;
    }
    const domain = properties.get(key);
    if (!domain) problems.push(`${where}: unknown property "${key}"`);
    else if (nodeTypes.length && !domain.some((d) => lineage.has(d)))
      problems.push(`${where}: "${key}" is not a property of ${nodeTypes.join('/')}`);
    checkNode(value, `${where}.${key}`, problems, byId);
  }
}

let blocks = 0;
const failures = [];
for (const file of files) {
  const html = await readFile(`dist/${file}`, 'utf8');
  for (const [, source] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    blocks++;
    try {
      const doc = JSON.parse(source);
      if (doc['@context'] !== 'https://schema.org') throw new Error(`@context is ${doc['@context']}, not https://schema.org`);
      await jsonld.expand(doc, { documentLoader, safe: true });
      const byId = new Map([doc['@graph'] ?? doc].flat().filter((n) => n['@id']).map((n) => [n['@id'], n]));
      const problems = [];
      checkNode(doc, 'root', problems, byId);
      problems.push(...checkDateModified(doc, file));
      if (problems.length) throw new Error(problems.join('; '));
    } catch (e) {
      failures.push(`${file}: ${e.message}`);
    }
  }
}

console.log(`${blocks} JSON-LD block(s) in ${files.length} page(s), ${failures.length} invalid.`);
for (const f of failures) console.error(f);
process.exit(failures.length || !blocks ? 1 : 0);
