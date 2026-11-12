import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pairs } from './pages';

// Decision 5: English at /, French at /fr/ and, for the core pages, German at /de/; each page links to
// its twins with hreflang and a language switch. The canonical and og:url of a page are its own address.
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

for (const { en, fr, de, canonical } of pairs) {
  test.describe(`${en} and ${fr}`, () => {
    // All pages of a pair list the same alternates, so each points at the others (reciprocal).
    const alternates = [
      ['en', `${SITE}${canonical.en}`],
      ['fr', `${SITE}${canonical.fr}`],
      ...(canonical.de ? [['de', `${SITE}${canonical.de}`]] : []),
      ['x-default', `${SITE}${canonical.en}`],
    ];

    test('the English page is in English and points to its French twin', async ({ page }) => {
      await page.goto(en);
      expect(await head(page)).toEqual({ lang: 'en', canonical: `${SITE}${canonical.en}`, ogUrl: `${SITE}${canonical.en}`, ogLocale: null, alternates });
    });

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

    if (de && canonical.de) {
      test('the German page is in German at its own address and points to its twins', async ({ page }) => {
        await page.goto(de);
        expect(await head(page)).toEqual({ lang: 'de-DE', canonical: `${SITE}${canonical.de}`, ogUrl: `${SITE}${canonical.de}`, ogLocale: 'de_DE', alternates });
      });

      test('the footer switches from English to German and back', async ({ page, baseURL }) => {
        await page.goto(en);
        await page.getByRole('contentinfo').getByRole('link', { name: 'Deutsch' }).click();
        await expect(page).toHaveURL(`${baseURL}${canonical.de}`);
        await page.getByRole('contentinfo').getByRole('link', { name: 'English' }).click();
        await expect(page).toHaveURL(`${baseURL}${canonical.en}`);
      });
    } else {
      test('the page has no German twin, so the footer offers none', async ({ page }) => {
        await page.goto(en);
        await expect(page.getByRole('contentinfo').getByRole('link', { name: 'Deutsch' })).toHaveCount(0);
      });
    }
  });
}

/**
 * Page addresses in the page's JSON-LD: every https://cachedrop.io URL except the shared
 * Organization (one entity in both languages) and asset files like the logo.
 */
async function jsonLdPageUrls(page: Page) {
  const docs = await page.locator('script[type="application/ld+json"]').allTextContents();
  const urls: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === 'string') {
      if (node.startsWith(SITE) && !node.includes('/assets/')) urls.push(node);
    } else if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === 'object') {
      const o = node as Record<string, unknown>;
      if (o['@type'] === 'Organization' || String(o['@id'] ?? '').endsWith('#org')) return;
      Object.values(o).forEach(walk);
    }
  };
  docs.forEach((d) => walk(JSON.parse(d)));
  return urls;
}

for (const { en, fr, canonical } of pairs) {
  test(`JSON-LD on ${fr} points at French addresses, and on ${en} at English ones`, async ({ page }) => {
    await page.goto(fr);
    const french = await jsonLdPageUrls(page);
    await page.goto(en);
    const english = await jsonLdPageUrls(page);
    test.skip(!french.length && !english.length, 'no structured data on this page');
    expect(french).toContain(`${SITE}${canonical.fr}`);
    for (const url of french) expect(url).toMatch(new RegExp(`^${SITE}/fr/`));
    expect(english).toContain(`${SITE}${canonical.en}`);
    for (const url of english) expect(url).not.toMatch(new RegExp(`^${SITE}/fr/`));
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
  for (const { canonical } of pairs.filter((p) => p.indexed)) {
    for (const loc of [canonical.en, canonical.fr]) {
      const entry = xml.match(new RegExp(`<url><loc>${SITE}${loc}</loc>[\\s\\S]*?</url>`))?.[0];
      expect(entry, loc).toBeTruthy();
      expect(entry).toContain(`<xhtml:link rel="alternate" hreflang="en" href="${SITE}${canonical.en}"/>`);
      expect(entry).toContain(`<xhtml:link rel="alternate" hreflang="fr" href="${SITE}${canonical.fr}"/>`);
      expect(entry).toContain(`<xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${canonical.en}"/>`);
    }
  }
});

test('the sitemap lists each German page, with all three alternates', async () => {
  const xml = await readFile('dist/sitemap.xml', 'utf8');
  for (const { canonical } of pairs.filter((p) => p.indexed && p.canonical.de)) {
    for (const loc of [canonical.en, canonical.fr, canonical.de!]) {
      const entry = xml.match(new RegExp(`<url><loc>${SITE}${loc}</loc>[\\s\\S]*?</url>`))?.[0];
      expect(entry, loc).toBeTruthy();
      expect(entry).toContain(`<xhtml:link rel="alternate" hreflang="de" href="${SITE}${canonical.de}"/>`);
    }
  }
});
