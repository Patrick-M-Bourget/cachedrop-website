import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

// The System Data guide (#110): a guide in the other guides' format (Decision 50), with a HowTo and an FAQPage
// in its JSON-LD and an Updated date in step with the sitemap.

async function jsonLd(page: Page) {
  const raw = await page.locator('script[type="application/ld+json"]').first().textContent();
  return JSON.parse(raw!)['@graph'] as Array<Record<string, unknown>>;
}

const langs = [
  { path: '/clear-system-data-mac/', h1: 'How to clear System Data on Mac', cta: 'Download for Mac', download: '/download/', footer: 'Clear System Data', wait: 'Clear System Data guide', updated: 'Updated November 2026' },
  { path: '/fr/clear-system-data-mac/', h1: 'Comment vider les Données système sur Mac', cta: 'Télécharger pour Mac', download: '/fr/download/', footer: 'Vider les Données système', wait: 'Guide pour vider les Données système', updated: 'Mis à jour en novembre 2026' },
] as const;

for (const l of langs) {
  test.describe(l.path, () => {
    test('has the ticket’s H1 and leads to the download form like the other guides', async ({ page }) => {
      await page.goto(l.path);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(l.h1);
      await expect(page.locator('main section').first().getByRole('link', { name: l.cta })).toHaveAttribute('href', l.download);
    });

    test('opens every section with an answer paragraph of two sentences', async ({ page }) => {
      await page.goto(l.path);
      const firsts = await page.locator('main section[id]:not(#faq) > h2 + p').allTextContents();
      expect(firsts).toHaveLength(6);
      for (const p of firsts) expect(p.match(/[.:?](\s|$)/g)?.length ?? 0, p).toBeGreaterThanOrEqual(2);
    });

    test('describes the manual way as a HowTo, keeps the FAQ in step and dates the page', async ({ page }) => {
      await page.goto(l.path);
      const graph = await jsonLd(page);
      const howTo = graph.find((n) => n['@type'] === 'HowTo') as { step: Array<{ text: string }> };
      const steps = await page.locator('#clear ol').first().locator('li').allTextContents();
      expect(howTo.step.map((s) => s.text)).toEqual(steps);
      const faq = graph.find((n) => n['@type'] === 'FAQPage') as { mainEntity: Array<{ name: string }> };
      expect(faq.mainEntity.map((q) => q.name)).toEqual(await page.locator('#faq h3').allTextContents());
      const article = graph.find((n) => n['@type'] === 'Article') as { dateModified: string };
      expect(article.dateModified).toBe('2026-11-03');
      await expect(page.getByText(l.updated)).toBeVisible();
    });

    test('warns before the one command that deletes anything, and lists snapshots read-only first', async ({ page }) => {
      await page.goto(l.path);
      const codes = await page.locator('#snapshots pre').allTextContents();
      expect(codes).toEqual(['tmutil listlocalsnapshots /', 'sudo tmutil deletelocalsnapshots 2026-11-03-101112']);
      const order = await page.locator('#snapshots').evaluate((s) => [...s.children].map((c) => (c.matches('[data-warning]') ? 'warn' : c.querySelector('pre') ? 'code' : '')).filter(Boolean));
      expect(order).toEqual(['code', 'warn', 'code']);
      // Every other command on the page only reads.
      const others = await page.locator('main pre').allTextContents();
      expect(others.filter((c) => /\b(rm|delete)/.test(c))).toEqual([codes[1]]);
    });
  });
}

test('the sitemap dates the guide as its Updated line does', async () => {
  const xml = await readFile('dist/sitemap.xml', 'utf8');
  for (const path of ['/clear-system-data-mac/', '/fr/clear-system-data-mac/'])
    expect(xml).toContain(`<loc>https://cachedrop.io${path}</loc><lastmod>2026-11-03</lastmod>`);
});

// Decision 48: the copy never claims what the app doesn't do. CacheDrop doesn't delete local snapshots
// (mac-cleaner #637) or clear system caches and logs (#641), and never asks for an admin password.
test('makes no claim the app contradicts', async ({ page }) => {
  for (const l of langs) {
    await page.goto(l.path);
    const text = (await page.locator('main').innerText()).toLowerCase();
    for (const banned of ['cachedrop deletes local snapshots', 'cachedrop deletes time machine', 'clears system caches', 'clears system data completely', 'supprime les instantanés locaux time machine pour vous'])
      expect(text, `${l.path} says "${banned}"`).not.toContain(banned);
    expect(text).toMatch(/never deletes time machine local snapshots|ne supprime jamais les instantanés locaux time machine/);
  }
});
