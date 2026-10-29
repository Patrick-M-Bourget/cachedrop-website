import { test, expect } from '@playwright/test';
import { pages } from './pages';

// Decision 19: the privacy policy is linked from the footer of every page.
for (const p of pages) {
  test(`${p.path} footer links to the privacy policy`, async ({ page }) => {
    await page.goto(p.path);
    const link = page.getByRole('contentinfo').getByRole('link', { name: 'Privacy Policy' });
    await expect(link).toHaveAttribute('href', '/privacy/');
    await link.click();
    await expect(page).toHaveURL(/\/privacy\/$/);
  });
}
