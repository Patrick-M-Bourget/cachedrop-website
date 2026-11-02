import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { withPricing } from './pricing-sitemap.mjs';

// Decision 44: /pricing/ and /fr/pricing/ join the sitemap only in a build with pricing live.
const sitemap = readFileSync(new URL('../public/sitemap.xml', import.meta.url), 'utf8');
const locs = (xml: string) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

describe('the pricing pages in the sitemap', () => {
  it('adds /pricing/ and /fr/pricing/, each with both alternates, after the other entries', () => {
    const xml = withPricing(sitemap, '2026-11-01');
    expect(locs(xml)).toEqual([...locs(sitemap), 'https://cachedrop.io/pricing/', 'https://cachedrop.io/fr/pricing/']);
    const entry = xml.slice(xml.indexOf('<url><loc>https://cachedrop.io/fr/pricing/'));
    expect(entry).toContain('<lastmod>2026-11-01</lastmod>');
    expect(entry).toContain('<xhtml:link rel="alternate" hreflang="en" href="https://cachedrop.io/pricing/"/>');
    expect(entry).toContain('<xhtml:link rel="alternate" hreflang="fr" href="https://cachedrop.io/fr/pricing/"/>');
    expect(entry).toContain('<xhtml:link rel="alternate" hreflang="x-default" href="https://cachedrop.io/pricing/"/>');
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true);
  });

  it('leaves the source sitemap without them', () => {
    expect(sitemap).not.toContain('/pricing/');
  });
});
