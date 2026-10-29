import { test, expect } from '@playwright/test';
import { pages, uiOf } from './pages';

// The feedback modal ships on every page (HANDOFF.md §7): opens from any
// [data-feedback] link, traps focus, closes on Escape and backdrop click.
for (const p of pages) {
  const t = uiOf(p);
  test.describe(`feedback modal on ${p.path}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(p.path);
    });

    test('opens from a feedback link with focus inside the dialog', async ({ page }) => {
      const dialog = page.getByRole('dialog', { name: t.dialog });
      await expect(dialog).toBeHidden();
      await page.locator('[data-feedback]').first().click();
      await expect(dialog).toBeVisible();
      await expect(page.getByRole('button', { name: t.veryUnhappy })).toBeFocused();
    });

    test('keeps Tab and Shift+Tab inside the dialog', async ({ page }) => {
      await page.locator('[data-feedback]').first().click();
      const first = page.getByRole('button', { name: t.close });
      const last = page.getByRole('button', { name: t.submit });
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
      const dialog = page.getByRole('dialog', { name: t.dialog });
      await expect(dialog).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(opener).toBeFocused();
    });

    test('closes on a backdrop click but not on a click inside the card', async ({ page }) => {
      await page.locator('[data-feedback]').first().click();
      const dialog = page.getByRole('dialog', { name: t.dialog });
      await dialog.getByText(t.rating).click();
      await expect(dialog).toBeVisible();
      await page.mouse.click(5, 5);
      await expect(dialog).toBeHidden();
    });

    test('opens on load when the URL ends in #feedback', async ({ page }) => {
      await page.goto(`${p.path}#feedback`);
      await page.reload(); // a fresh load, not a same-page hash change
      await expect(page.getByRole('dialog', { name: t.dialog })).toBeVisible();
    });
  });
}

// Submitting (Decisions 6, 10). The static preview has no functions, so /api/feedback is stubbed
// here; tests/feedback-journey.spec.ts runs the real one on a Vercel preview.
test.describe('submitting feedback', () => {
  async function stub(page: import('@playwright/test').Page, status = 200) {
    const sent: Array<Record<string, unknown>> = [];
    await page.route('**/api/feedback', async (route) => {
      sent.push(route.request().postDataJSON());
      await route.fulfill({ status, contentType: 'application/json', body: status === 200 ? '{"ok":true}' : '{"error":"invalid"}' });
    });
    await page.goto('/clear-mac-developer-caches/#feedback');
    await page.reload();
    return sent;
  }

  test('the specs box starts unticked, and says what it sends', async ({ page }) => {
    await stub(page);
    const box = page.getByRole('checkbox', { name: /Send anonymous system specs/ });
    await expect(box).not.toBeChecked();
    await expect(page.locator('label[for=fb-specs]')).toHaveText('Send anonymous system specs (browser user agent, platform and language)');
  });

  test('sends no specs unless the box is ticked', async ({ page }) => {
    const sent = await stub(page);
    await page.getByRole('button', { name: 'Happy', exact: true }).click();
    await page.getByLabel('Email (optional)').fill('ada@example.com');
    await page.getByLabel('What should we change?').fill('More guides please');
    await page.getByRole('button', { name: 'Submit Feedback' }).click();
    await expect(page.getByText('Thanks, that helps.')).toBeVisible();
    expect(sent).toEqual([{ rating: 'happy', email: 'ada@example.com', message: 'More guides please', page: '/clear-mac-developer-caches/', specs: null, turnstile: 'XXXX.DUMMY.TOKEN.XXXX' }]);
  });

  test('sends the browser user agent, platform and language when the box is ticked', async ({ page }) => {
    const sent = await stub(page);
    await page.getByLabel('What should we change?').fill('Crashed on scan');
    await page.getByRole('checkbox', { name: /Send anonymous system specs/ }).check();
    await page.getByRole('button', { name: 'Submit Feedback' }).click();
    await expect(page.getByText('Thanks, that helps.')).toBeVisible();
    const ua = await page.evaluate(() => ({ userAgent: navigator.userAgent, platform: navigator.platform, language: navigator.language }));
    expect(sent[0].specs).toEqual(ua);
  });

  test('shows the existing error copy when the server refuses', async ({ page }) => {
    await stub(page, 400);
    await page.getByLabel('What should we change?').fill('Hi');
    await page.getByRole('button', { name: 'Submit Feedback' }).click();
    await expect(page.getByRole('alert')).toHaveText('We couldn’t send that. Check your connection and try again.');
    await expect(page.getByText('Thanks, that helps.')).toBeHidden();
  });

  test('keeps the fields within what the server accepts, and links to the privacy policy', async ({ page }) => {
    await stub(page);
    await expect(page.getByLabel('What should we change?')).toHaveAttribute('maxlength', '5000');
    await expect(page.getByLabel('Email (optional)')).toHaveAttribute('maxlength', '254');
    await expect(page.getByRole('dialog').getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy/');
  });
});

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
