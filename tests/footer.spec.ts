import { test, expect } from '@playwright/test';
import { pages, ui, uiOf } from './pages';

// Decision 19: the privacy policy is linked from the footer of every page.
for (const p of pages) {
  test(`${p.path} footer links to the privacy policy`, async ({ page }) => {
    const [name, href] = uiOf(p).privacy;
    await page.goto(p.path);
    const link = page.getByRole('contentinfo').getByRole('link', { name });
    await expect(link).toHaveAttribute('href', href);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
  });
}

// Decision 43: the terms of sale, refund policy and license agreement are linked from the footer of
// every page, in the page's language, and each link resolves.
for (const p of pages) {
  test(`${p.path} footer links to the sale pages`, async ({ page }) => {
    await page.goto(p.path);
    for (const [name, href] of uiOf(p).legal) {
      const link = page.getByRole('contentinfo').getByRole('link', { name, exact: true });
      await expect(link, name).toHaveAttribute('href', href);
    }
  });
}

for (const lang of ['en', 'fr'] as const) {
  test(`${lang}: each sale page link in the footer opens its page`, async ({ page }) => {
    for (const [name, href] of ui[lang].legal) {
      await page.goto(ui[lang].home);
      await page.getByRole('contentinfo').getByRole('link', { name, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${href}$`));
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }
  });
}
