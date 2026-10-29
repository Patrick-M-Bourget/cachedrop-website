import { test, expect, type APIRequestContext } from '@playwright/test';

// Unsubscribe end to end on a Vercel preview (Decision 4, #10), against the dev Supabase project:
// signup → captured email → its one-click header and its link. Skipped unless PREVIEW_URL is set.
// Run it like tests/gate-journey.spec.ts:
//   vercel env run -- sh -c 'PREVIEW_URL=https://<preview> npx playwright test tests/unsubscribe-journey.spec.ts'
const PREVIEW = process.env.PREVIEW_URL;
const OIDC = process.env.VERCEL_OIDC_TOKEN;

test.skip(!PREVIEW, 'set PREVIEW_URL to run the journey against a preview');

const protection = (): Record<string, string> => (OIDC ? { 'x-vercel-trusted-oidc-idp-token': OIDC } : {});
const ONE_CLICK = { 'content-type': 'application/x-www-form-urlencoded', ...protection() };

/** Signs up a fresh address and returns the captured email's unsubscribe link and one-click URL. */
async function signUp(request: APIRequestContext) {
  const res = await request.post('/api/signup', {
    // Previews hold Turnstile's always-pass key, and this run counts under its own rate-limit key (#12).
    headers: { ...protection(), 'x-capture-email': '1', 'x-rate-limit-key': `unsubscribe-journey-${Date.now()}-${Math.random()}` },
    data: { email: `unsubscribe-journey+${Date.now()}@example.com`, turnstile: 'XXXX.DUMMY.TOKEN.XXXX' },
  });
  expect(res.status()).toBe(200);
  const { captured } = await res.json();
  expect(captured.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  const oneClick = new URL(captured.headers['List-Unsubscribe'].match(/^<(https:\/\/[^>]+)>$/)[1]);
  const link = new URL(captured.text.match(/https:\/\/\S+\/unsubscribe\/[A-Za-z0-9_-]{43}\//)[0]);
  expect(oneClick.origin).toBe(new URL(PREVIEW!).origin);
  expect(link.searchParams.size).toBe(0);
  expect(oneClick.searchParams.get('token')).toBe(link.pathname.split('/')[2]);
  return { link, oneClick };
}

test('the one-click POST unsubscribes with an empty 200, twice, and a GET only goes to the page', async ({ request }) => {
  const { link, oneClick } = await signUp(request);

  const opened = await request.get(oneClick.href, { headers: protection(), maxRedirects: 0 });
  expect(opened.status()).toBe(303);
  expect(opened.headers().location).toBe(link.pathname);

  for (let i = 0; i < 2; i++) {
    const res = await request.post(oneClick.href, { headers: ONE_CLICK, data: 'List-Unsubscribe=One-Click', maxRedirects: 0 });
    expect(res.status()).toBe(200);
    expect(await res.text()).toBe('');
  }
});

test('the emailed link confirms in one sentence, and again on a second visit', async ({ page, request }) => {
  const { link } = await signUp(request);
  await page.route((url) => url.origin === link.origin, (route) => route.continue({ headers: { ...route.request().headers(), ...protection() } }));
  for (let i = 0; i < 2; i++) {
    await page.goto(link.pathname);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('You’re unsubscribed.');
  }
});

test('a forged token unsubscribes nobody', async ({ request, page }) => {
  const forged = 'A'.repeat(43);
  const res = await request.post(`/api/unsubscribe?token=${forged}`, { headers: ONE_CLICK, data: 'List-Unsubscribe=One-Click' });
  expect(res.status()).toBe(404);
  await page.route((url) => url.origin === new URL(PREVIEW!).origin, (route) => route.continue({ headers: { ...route.request().headers(), ...protection() } }));
  await page.goto(`/unsubscribe/${forged}/`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('This unsubscribe link doesn’t work.');
});
