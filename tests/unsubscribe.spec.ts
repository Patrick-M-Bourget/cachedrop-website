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

// Without JavaScript the page can't POST by itself, so it shows a confirm button instead. Its form
// posts to /unsubscribe/<token>/confirm, which vercel.json rewrites to /api/unsubscribe with the
// token; the API answers with a redirect to a confirmation page.
test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  const cases = [
    { lang: 'en', base: '', ask: 'Unsubscribe from CacheDrop emails', button: 'Unsubscribe', done: 'You’re unsubscribed.', pending: 'Unsubscribing…' },
    { lang: 'fr', base: '/fr', ask: 'Se désabonner des courriels de CacheDrop', button: 'Me désabonner', done: 'Désabonnement confirmé.', pending: 'Désabonnement en cours…' },
  ];
  for (const c of cases) {
    test(`${c.lang}: a confirm button posts the token and lands on a visible confirmation`, async ({ page }) => {
      await page.route(/\/unsubscribe\/[A-Za-z0-9_-]{43}\/$/, async (route) => {
        const built = await route.fetch({ url: new URL(`${c.base}/unsubscribe/`, route.request().url()).href });
        await route.fulfill({ response: built });
      });
      const posts: string[] = [];
      await page.route('**/confirm', async (route) => {
        posts.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
        await route.fulfill({ status: 303, headers: { location: `${c.base}/unsubscribe/done/` } });
      });
      await page.goto(`${c.base}/unsubscribe/${TOKEN}/`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(c.ask);
      await expect(page.getByText(c.pending)).toBeHidden();
      await page.getByRole('button', { name: c.button }).click();
      await expect(page).toHaveURL(new RegExp(`${c.base}/unsubscribe/done/$`));
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(c.done);
      expect(posts).toEqual([`POST ${c.base}/unsubscribe/${TOKEN}/confirm`]);
    });
  }

  test('the result pages say what happened, without a script', async ({ page }) => {
    for (const [path, heading] of [
      ['/unsubscribe/done/', 'You’re unsubscribed.'],
      ['/unsubscribe/invalid/', 'This unsubscribe link doesn’t work.'],
      ['/unsubscribe/error/', 'Something went wrong.'],
      ['/fr/unsubscribe/done/', 'Désabonnement confirmé.'],
    ]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
    }
  });
});
