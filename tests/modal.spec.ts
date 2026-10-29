import { test, expect } from '@playwright/test';
import { pages } from './pages';

// The feedback modal ships on every page (HANDOFF.md §7): opens from any
// [data-feedback] link, traps focus, closes on Escape and backdrop click.
for (const p of pages) {
  test.describe(`feedback modal on ${p.path}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(p.path);
    });

    test('opens from a feedback link with focus inside the dialog', async ({ page }) => {
      const dialog = page.getByRole('dialog', { name: 'Give Fast Feedback' });
      await expect(dialog).toBeHidden();
      await page.locator('[data-feedback]').first().click();
      await expect(dialog).toBeVisible();
      await expect(page.getByRole('button', { name: 'Very unhappy' })).toBeFocused();
    });

    test('keeps Tab and Shift+Tab inside the dialog', async ({ page }) => {
      await page.locator('[data-feedback]').first().click();
      const first = page.getByRole('button', { name: 'Close feedback' });
      const last = page.getByRole('button', { name: 'Submit Feedback' });
      await last.focus();
      await page.keyboard.press('Tab');
      await expect(first).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(last).toBeFocused();
    });

    test('closes on Escape and returns focus to the opener', async ({ page }) => {
      const opener = page.locator('[data-feedback]').first();
      await opener.focus();
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog', { name: 'Give Fast Feedback' });
      await expect(dialog).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(opener).toBeFocused();
    });

    test('closes on a backdrop click but not on a click inside the card', async ({ page }) => {
      await page.locator('[data-feedback]').first().click();
      const dialog = page.getByRole('dialog', { name: 'Give Fast Feedback' });
      await dialog.getByText('Your rating').click();
      await expect(dialog).toBeVisible();
      await page.mouse.click(5, 5);
      await expect(dialog).toBeHidden();
    });

    test('opens on load when the URL ends in #feedback', async ({ page }) => {
      await page.goto(`${p.path}#feedback`);
      await page.reload(); // a fresh load, not a same-page hash change
      await expect(page.getByRole('dialog', { name: 'Give Fast Feedback' })).toBeVisible();
    });
  });
}

// The guides' code blocks copy their command through site.js and say so.
test('a Copy button copies its command and confirms', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/clear-mac-developer-caches/');
  const block = page.locator('#derived-data');
  await block.getByRole('button', { name: 'Copy', exact: true }).click();
  await expect(block.getByRole('button', { name: 'Copied' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('rm -rf ~/Library/Developer/Xcode/DerivedData/*');
  await expect(block.getByRole('button', { name: 'Copy', exact: true })).toBeVisible({ timeout: 3000 });
});
