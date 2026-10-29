import { test, expect } from '@playwright/test';
import { pages, uiOf } from './pages';

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
