import { test, expect } from '@playwright/test';
import { pages } from './pages';

// Decisions 51 and 52: no "beta" anywhere, no parenthesized "(Free)", and no "free" in a heading or
// a button. "Free up space" is the verb, not the price, so it stays allowed. The download email is
// checked in src/server/download-email.test.ts.
const all = [...pages.map((p) => p.path), '/pricing/', '/fr/pricing/'];
const BETA = /beta|bêta/i;
const PAREN_FREE = /\((free|gratuit)\)/i;
const FREE = /\bfree\b(?!\s+up)|gratuit/i;
// Hidden ones too (the download form's done state), so textContent rather than innerText.
const HEADINGS_AND_BUTTONS = 'h1, h2, h3, h4, h5, h6, button, [role="button"], .btn-primary, .btn-ghost, .gate-btn';

for (const path of all) {
  test(`${path}: no "beta", no "(Free)", and no "free" in a heading or button`, async ({ page }) => {
    await page.goto(path);
    const text = (await page.locator('body').textContent()) ?? '';
    expect(text).not.toMatch(BETA);
    expect(await page.locator('head').innerHTML()).not.toMatch(BETA);
    expect(text).not.toMatch(PAREN_FREE);
    const labels = await page.locator(HEADINGS_AND_BUTTONS).evaluateAll((els) => els.map((e) => e.textContent!.replace(/\s+/g, ' ').trim()));
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.filter((l) => FREE.test(l))).toEqual([]);
  });
}
