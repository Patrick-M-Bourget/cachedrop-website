// Shared pieces of the pages' JSON-LD (#94). Every page's structured data carries `dateModified`,
// which is its <lastmod> in public/sitemap.xml; scripts/check-jsonld.mjs fails the build if they differ.
import { readFileSync } from 'node:fs';
import { localize, type Lang } from '../i18n';

let sitemap: string | undefined;

/** The page's <lastmod> in public/sitemap.xml, e.g. `2026-11-02`, for its absolute `url`. */
export function lastModified(url: string): string {
  sitemap ??= readFileSync('public/sitemap.xml', 'utf8');
  const date = new RegExp(`<loc>${url.replaceAll('.', '\\.')}</loc><lastmod>([0-9-]{10})</lastmod>`).exec(sitemap)?.[1];
  if (!date) throw new Error(`public/sitemap.xml has no <lastmod> for ${url}`);
  return date;
}

/**
 * A page that is the second step of a breadcrumb from the homepage (the privacy and sale pages):
 * a WebPage carrying its dateModified, with the BreadcrumbList as its breadcrumb.
 */
export function breadcrumbPage(site: string, lang: Lang, path: string, name: string) {
  const url = `${site}${localize(lang, path)}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    url,
    name,
    dateModified: lastModified(url),
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'CacheDrop', item: `${site}${localize(lang, '/')}` },
        { '@type': 'ListItem', position: 2, name, item: url },
      ],
    },
  };
}
