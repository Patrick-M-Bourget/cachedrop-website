import { test, expect } from '@playwright/test';
import { pages, ui, uiOf } from './pages';

// Decision 44: with the launch setting off (the default build), nothing of pricing shows. The
// handoff screenshot and head comparisons cover the rest of "no visible change".
test('the pricing pages are not built', async ({ request }) => {
  for (const path of ['/pricing/', '/fr/pricing/']) expect((await request.get(path)).status(), path).toBe(404);
});

test('the sitemap does not list the pricing pages', async ({ request }) => {
  expect(await (await request.get('/sitemap.xml')).text()).not.toContain('/pricing/');
});

const beta = { en: ['BETA', 'Get Free Beta', 'Download Free Beta'], fr: ['BÊTA', 'Obtenir la bêta gratuite', 'Télécharger la bêta gratuite'] };

for (const p of pages) {
  test(`${p.path} keeps the beta nav and footer, with no pricing or Buy link`, async ({ page }) => {
    const lang = p.lang ?? 'en';
    const [badge, navButton, footerLink] = beta[lang];
    await page.goto(p.path);
    const nav = page.getByRole('banner');
    await expect(nav.getByText(badge, { exact: true })).toBeVisible();
    await expect(nav.getByRole('link', { name: navButton })).toHaveAttribute('href', uiOf(p).download);
    await expect(page.getByRole('contentinfo').getByRole('link', { name: footerLink })).toBeVisible();
    await expect(page.locator('a[href*="/pricing"]')).toHaveCount(0);
    await expect(page.locator('a[href^="/buy"]')).toHaveCount(0);
    await expect(page.locator('#pricing')).toHaveCount(0);
  });
}

for (const lang of ['en', 'fr'] as const) {
  test(`${lang}: the homepage offer is still free`, async ({ page }) => {
    await page.goto(ui[lang].home);
    const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
    expect(ld['@graph'][1].offers).toEqual({ '@type': 'Offer', price: '0', priceCurrency: 'USD' });
  });
}
