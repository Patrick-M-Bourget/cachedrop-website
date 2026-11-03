import { test, expect } from '@playwright/test';
import { pricingCopy } from '../src/components/pricing';

// The homepage rewrite (#109, Decision 51): the hero, then three value props, "Made for your work",
// "Safe by design", "Pay once" and the FAQ, in that order, in both languages.

const langs = [
  {
    path: '/',
    lang: 'en',
    title: 'Mac Cleaner – Get Your Mac’s Space Back, Pay Once | CacheDrop',
    h1: 'Get your Mac’s space back.',
    proof: 'CacheDrop found 18 GB of plug-ins on a music producer’s Mac',
    download: ['Download for Mac', '/download/'],
    buy: '/buy',
    cards: [
      ['How to uninstall audio plug-ins', '/uninstall-audio-plugins-mac/'],
      ['How to clear developer caches', '/clear-mac-developer-caches/'],
      ['How to clear Adobe media cache', '/clear-adobe-media-cache-mac/'],
    ],
    closing: 'Try it on your Mac.',
  },
  {
    path: '/fr/',
    lang: 'fr',
    title: 'Nettoyer son Mac – Récupérez votre espace, payez une fois | CacheDrop',
    h1: 'Récupérez l’espace de votre Mac.',
    proof: 'CacheDrop a trouvé 18 Go de plug-ins sur le Mac d’un producteur de musique',
    download: ['Télécharger pour Mac', '/fr/download/'],
    buy: '/buy?lang=fr',
    cards: [
      ['Comment désinstaller des plug-ins audio', '/fr/uninstall-audio-plugins-mac/'],
      ['Comment vider les caches de développement', '/fr/clear-mac-developer-caches/'],
      ['Comment vider le cache de média Adobe', '/fr/clear-adobe-media-cache-mac/'],
    ],
    closing: 'Essayez-le sur votre Mac.',
  },
] as const;

for (const l of langs) {
  test.describe(l.path, () => {
    test('has the new title, H1 and proof figure', async ({ page }) => {
      await page.goto(l.path);
      expect(await page.title()).toBe(l.title);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(l.h1);
      await expect(page.locator('[data-proof]')).toHaveText(l.proof);
    });

    test('the hero has "Download for Mac" and "Buy" only, with the trial line under them', async ({ page }) => {
      await page.goto(l.path);
      const hero = page.locator('#top');
      const links = await hero.locator('#download a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
      expect(links).toEqual([l.download[1], l.buy]);
      await expect(hero.getByRole('link', { name: l.download[0] })).toBeVisible();
      await expect(hero.locator('[data-feedback]')).toHaveCount(0);
      await expect(hero.getByText(pricingCopy[l.lang].trial, { exact: true })).toBeVisible();
    });

    test('runs value props, work, safety, pay once and FAQ in order', async ({ page }) => {
      await page.goto(l.path);
      const ids = await page.locator('section').evaluateAll((s) => s.map((e) => e.id).filter(Boolean));
      expect(ids).toEqual(['top', 'value', 'work', 'safe', 'pricing', 'faq']);
      await expect(page.locator('#value h3')).toHaveCount(3);
      await expect(page.locator('#safe li')).toHaveCount(5);
    });

    test('each work card links to its guide', async ({ page }) => {
      await page.goto(l.path);
      for (const [name, href] of l.cards) await expect(page.locator('#work').getByRole('link', { name })).toHaveAttribute('href', href);
    });

    test('"Pay once" sets the price beside CleanMyMac\'s yearly one', async ({ page }) => {
      await page.goto(l.path);
      await expect(page.locator('#pricing [data-versus]')).toHaveText(pricingCopy[l.lang].versus);
    });

    test('closes on "Try it on your Mac" with the download button and no feedback link', async ({ page }) => {
      await page.goto(l.path);
      const closing = page.getByRole('heading', { name: l.closing }).locator('xpath=ancestor::section');
      await expect(closing.getByRole('link', { name: l.download[0] })).toHaveAttribute('href', l.download[1]);
      await expect(closing.locator('[data-feedback]')).toHaveCount(0);
    });

    test('the structured data carries the fact sheet', async ({ page }) => {
      await page.goto(l.path);
      const raw = await page.locator('script[type="application/ld+json"]').first().textContent();
      const app = JSON.parse(raw!)['@graph'].find((g: { '@type': string }) => g['@type'] === 'SoftwareApplication');
      expect(app.featureList).toEqual(pricingCopy[l.lang].items);
      expect(app.processorRequirements).toBe('Apple Silicon, Intel');
    });
  });
}
