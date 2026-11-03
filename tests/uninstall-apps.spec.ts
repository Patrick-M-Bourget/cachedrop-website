import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

// The app uninstall guide (#111, Decisions 50 and 51): a guide that leads with leftovers, with a HowTo and
// FAQPage in its JSON-LD, linked with the producer page, the footer and the sitemap.

async function jsonLd(page: Page) {
  const raw = await page.locator('script[type="application/ld+json"]').first().textContent();
  return JSON.parse(raw!)['@graph'] as Array<Record<string, unknown>>;
}

const langs = [
  { path: '/uninstall-apps-mac/', h1: 'How to completely uninstall apps on Mac', cta: 'Download for Mac', download: '/download/', footer: 'Uninstall Apps', producer: '/uninstall-audio-plugins-mac/' },
  { path: '/fr/uninstall-apps-mac/', h1: 'Comment désinstaller complètement une application sur Mac', cta: 'Télécharger pour Mac', download: '/fr/download/', footer: 'Désinstaller des applications', producer: '/fr/uninstall-audio-plugins-mac/' },
] as const;

for (const l of langs) {
  test.describe(l.path, () => {
    test('has the ticket\'s H1, leads with leftovers and sends the download button to the form', async ({ page }) => {
      await page.goto(l.path);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(l.h1);
      await expect(page.locator('main section').first().getByRole('link', { name: l.cta })).toHaveAttribute('href', l.download);
      await expect(page.locator('main section h2').first()).toContainText(/Library|Bibliothèque/);
    });

    test('describes the manual uninstall as a HowTo and keeps the FAQ in step', async ({ page }) => {
      await page.goto(l.path);
      const graph = await jsonLd(page);
      const howTo = graph.find((n) => n['@type'] === 'HowTo') as { step: Array<{ text: string }> };
      const steps = await page.locator('#manual ol').first().locator('li').allTextContents();
      expect(steps.length).toBeGreaterThan(3);
      expect(howTo.step.map((s) => s.text)).toEqual(steps);
      const faq = graph.find((n) => n['@type'] === 'FAQPage') as { mainEntity: Array<{ name: string }> };
      expect(faq.mainEntity.map((q) => q.name)).toEqual(await page.locator('#faq h3').allTextContents());
    });

    test('links to the producer page, and the producer page and footer link back', async ({ page }) => {
      await page.goto(l.path);
      await expect(page.locator(`main a[href="${l.producer}"]`)).toHaveCount(2); // in the body and the other-guide aside
      await expect(page.getByRole('contentinfo').getByRole('link', { name: l.footer, exact: true })).toHaveAttribute('href', l.path);
      await page.goto(l.producer);
      await expect(page.locator(`#deleted-apps a[href="${l.path}"]`)).toHaveCount(1);
    });
  });
}

test('the sitemap lists the guide in both languages', async () => {
  const xml = await readFile('dist/sitemap.xml', 'utf8');
  for (const l of langs) expect(xml).toContain(`<loc>https://cachedrop.io${l.path}</loc>`);
});

// Claims follow the app (Decisions 48 and 51): uninstalls count toward the trial, and the app's own names are used.
test('makes no claim the app contradicts', async ({ page }) => {
  for (const l of langs) {
    await page.goto(l.path);
    const text = (await page.locator('main').innerText()).toLowerCase();
    for (const banned of ['uninstall for free', 'deleted permanently', 'unused apps', 'junk', 'désinstallation gratuite'])
      expect(text, `${l.path} says "${banned}"`).not.toContain(banned);
    for (const name of ['files from deleted apps', 'possibly related', 'put back', 'needs your password to remove'])
      expect(text, `${l.path} names "${name}"`).toContain(name);
  }
});
