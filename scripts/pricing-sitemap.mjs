// Decision 44: public/sitemap.xml lists the site without the pricing pages. In a build with the
// launch setting on (PUBLIC_PRICING_LIVE=1), astro.config.mjs adds /pricing/ and /fr/pricing/ to
// the built copy, in the same shape as the other entries (Decision 5's alternates).
import { readFile, writeFile } from 'node:fs/promises';

const SITE = 'https://cachedrop.io';

/** Pricing's lastmod: the day the pages were written. */
export const PRICING_LASTMOD = '2026-11-01';

/** The sitemap `xml` with the two pricing entries added before `</urlset>`. */
export function withPricing(xml, lastmod = PRICING_LASTMOD) {
  const alternates = [
    ['en', `${SITE}/pricing/`],
    ['fr', `${SITE}/fr/pricing/`],
    ['x-default', `${SITE}/pricing/`],
  ]
    .map(([lang, href]) => `    <xhtml:link rel="alternate" hreflang="${lang}" href="${href}"/>\n`)
    .join('');
  const entries = [`${SITE}/pricing/`, `${SITE}/fr/pricing/`]
    .map((loc) => `  <url><loc>${loc}</loc><lastmod>${lastmod}</lastmod>\n${alternates}  </url>\n`)
    .join('');
  return xml.replace('</urlset>', `${entries}</urlset>`);
}

/** An Astro integration that rewrites the built sitemap.xml when `live`. */
export const pricingSitemap = (live) => ({
  name: 'pricing-sitemap',
  hooks: {
    'astro:build:done': async ({ dir }) => {
      if (!live) return;
      const file = new URL('sitemap.xml', dir);
      await writeFile(file, withPricing(await readFile(file, 'utf8')));
    },
  },
});
