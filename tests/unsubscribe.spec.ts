import { test, expect, type Page } from '@playwright/test';

// The unsubscribe page (Decision 4, #10). Locally there is no API and no vercel.json rewrite, so
// these tests serve the built page at /unsubscribe/<token>/ and answer /api/unsubscribe themselves.
// tests/unsubscribe-journey.spec.ts runs the real thing on a preview.
const TOKEN = 'u'.repeat(43);

async function open(page: Page, api: number | 'offline', path = `/unsubscribe/${TOKEN}/`) {
  const calls: Array<{ method: string; url: string; body: string | null }> = [];
  await page.route(/\/unsubscribe\/[A-Za-z0-9_-]{43}\/$/, async (route) => {
    const built = await route.fetch({ url: new URL('/unsubscribe/', route.request().url()).href });
    await route.fulfill({ response: built });
  });
  await page.route('**/api/unsubscribe?*', async (route) => {
    const req = route.request();
    calls.push({ method: req.method(), url: req.url(), body: req.postData() });
    if (api === 'offline') return route.abort();
    await route.fulfill({ status: api, body: '' });
  });
  await page.goto(path);
  return calls;
}

test('opening the emailed link unsubscribes with the one-click POST and confirms in one sentence', async ({ page }) => {
  const calls = await open(page, 200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('You’re unsubscribed.');
  await expect(page.getByText('CacheDrop won’t send update or news emails to this address any more.')).toBeVisible();
  expect(calls).toEqual([
    { method: 'POST', url: expect.stringMatching(new RegExp(`/api/unsubscribe\\?token=${TOKEN}$`)), body: 'List-Unsubscribe=One-Click' },
  ]);
  // No preferences page: nothing to fill in or choose.
  await expect(page.locator('main').locator('input, select, button')).toHaveCount(0);
});

test('a forged or unknown token says the link doesn’t work', async ({ page }) => {
  await open(page, 404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('This unsubscribe link doesn’t work.');
  await expect(page.getByRole('main').getByRole('link', { name: 'hello@cachedrop.io' })).toHaveAttribute('href', 'mailto:hello@cachedrop.io');
});

test('the page without a token asks nothing of the API', async ({ page }) => {
  const calls = await open(page, 200, '/unsubscribe/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('This unsubscribe link doesn’t work.');
  expect(calls).toEqual([]);
});

for (const api of [503, 'offline'] as const) {
  test(`says to try again when the API is ${api === 'offline' ? 'unreachable' : 'down'}`, async ({ page }) => {
    await open(page, api);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Something went wrong.');
  });
}

test('is kept out of search results', async ({ page }) => {
  await open(page, 200);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
});
