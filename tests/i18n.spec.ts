import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pairs } from './pages';

// Decision 5: English at /, French at /fr/, each page linking to the other with hreflang
// and a language switch. The canonical and og:url of a French page are its own /fr/ address.
const SITE = 'https://cachedrop.io';

async function head(page: Page) {
  return page.evaluate(() => ({
    lang: document.documentElement.lang,
    canonical: document.querySelector('link[rel=canonical]')?.getAttribute('href'),
    ogUrl: document.querySelector('meta[property="og:url"]')?.getAttribute('content'),
    ogLocale: document.querySelector('meta[property="og:locale"]')?.getAttribute('content') ?? null,
    alternates: [...document.querySelectorAll('link[rel=alternate][hreflang]')].map((l) => [l.getAttribute('hreflang'), l.getAttribute('href')]),
  }));
}

for (const { en, fr, canonical, pending } of pairs) {
  test.describe(`${en} and ${fr}`, () => {
    // Both pages of a pair list the same alternates, so each points at the other (reciprocal).
    const alternates = [
      ['en', `${SITE}${canonical.en}`],
      ['fr', `${SITE}${canonical.fr}`],
      ['x-default', `${SITE}${canonical.en}`],
    ];

    test('the English page is in English and points to its French twin', async ({ page }) => {
      await page.goto(en);
      expect(await head(page)).toEqual({ lang: 'en', canonical: `${SITE}${canonical.en}`, ogUrl: `${SITE}${canonical.en}`, ogLocale: null, alternates });
    });

    if (pending) return; // the French twin comes in a later PR of #13

    test('the French page is in French at its own address and points back', async ({ page }) => {
      await page.goto(fr);
      expect(await head(page)).toEqual({ lang: 'fr-CA', canonical: `${SITE}${canonical.fr}`, ogUrl: `${SITE}${canonical.fr}`, ogLocale: 'fr_CA', alternates });
    });

    test('the footer switches from English to French and back', async ({ page, baseURL }) => {
      await page.goto(en);
      await page.getByRole('contentinfo').getByRole('link', { name: 'Français' }).click();
      await expect(page).toHaveURL(`${baseURL}${canonical.fr}`);
      await page.getByRole('contentinfo').getByRole('link', { name: 'English' }).click();
      await expect(page).toHaveURL(`${baseURL}${canonical.en}`);
    });
  });
}

test('the sitemap leaves out every page that is not indexed, in both languages', async () => {
  const xml = await readFile('dist/sitemap.xml', 'utf8');
  for (const { canonical } of pairs.filter((p) => !p.indexed)) {
    expect(xml).not.toContain(`${SITE}${canonical.en}<`);
    expect(xml).not.toContain(`${SITE}${canonical.fr}<`);
  }
});

test('the sitemap lists each indexed page in both languages, with alternates', async () => {
  const xml = await readFile('dist/sitemap.xml', 'utf8');
  for (const { canonical } of pairs.filter((p) => p.indexed && !p.pending)) {
    for (const loc of [canonical.en, canonical.fr]) {
      const entry = xml.match(new RegExp(`<url><loc>${SITE}${loc}</loc>[\\s\\S]*?</url>`))?.[0];
      expect(entry, loc).toBeTruthy();
      expect(entry).toContain(`<xhtml:link rel="alternate" hreflang="en" href="${SITE}${canonical.en}"/>`);
      expect(entry).toContain(`<xhtml:link rel="alternate" hreflang="fr" href="${SITE}${canonical.fr}"/>`);
      expect(entry).toContain(`<xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${canonical.en}"/>`);
    }
  }
});
