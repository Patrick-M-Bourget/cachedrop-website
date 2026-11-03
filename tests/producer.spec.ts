import { test, expect, type Page } from '@playwright/test';

// The producer page (#52, Decisions 48 to 50): a guide in the other guides' format, with a HowTo in its
// JSON-LD and a nav link.

async function jsonLd(page: Page) {
  const raw = await page.locator('script[type="application/ld+json"]').first().textContent();
  return JSON.parse(raw!)['@graph'] as Array<Record<string, unknown>>;
}

const langs = [
  { path: '/uninstall-audio-plugins-mac/', lang: 'en', cta: 'Download for Mac', download: '/download/', nav: 'For Music Producers' },
  { path: '/fr/uninstall-audio-plugins-mac/', lang: 'fr', cta: 'Télécharger pour Mac', download: '/fr/download/', nav: 'Pour les producteurs de musique' },
] as const;

for (const l of langs) {
  test.describe(l.path, () => {
    test('leads to the download form like the other guides, with no form of its own', async ({ page }) => {
      await page.goto(l.path);
      await expect(page.locator('[data-gate-form]')).toHaveCount(0);
      const hero = page.locator('main section').first().getByRole('link', { name: l.cta });
      await expect(hero).toHaveAttribute('href', l.download);
    });

    test('marks its nav link as the current page', async ({ page }) => {
      await page.goto(l.path);
      await expect(page.getByRole('link', { name: l.nav })).toHaveAttribute('aria-current', 'page');
    });

    test('describes the manual uninstall as a HowTo and keeps the FAQ in step', async ({ page }) => {
      await page.goto(l.path);
      const graph = await jsonLd(page);
      const howTo = graph.find((n) => n['@type'] === 'HowTo') as { step: Array<{ text: string }> };
      const steps = await page.locator('#uninstall ol').first().locator('li').allTextContents();
      expect(howTo.step.map((s) => s.text)).toEqual(steps);
      const faq = graph.find((n) => n['@type'] === 'FAQPage') as { mainEntity: Array<{ name: string }> };
      expect(faq.mainEntity.map((q) => q.name)).toEqual(await page.locator('#faq h3').allTextContents());
    });
  });
}

// Decision 48: the copy never claims what the app doesn't do.
test('makes no claim the app contradicts', async ({ page }) => {
  for (const l of langs) {
    await page.goto(l.path);
    const text = (await page.locator('main').innerText()).toLowerCase();
    for (const banned of ['unused plug-ins', 'duplicate plug-ins', 'every format at once', 'uninstall for free', 'plug-ins inutilisés'])
      expect(text, `${l.path} says "${banned}"`).not.toContain(banned);
  }
});
