import { test, expect, type Page } from '@playwright/test';

// The email gate end to end on a Vercel preview (Decision 27): form → captured email → token page
// → download response, against the dev Supabase project. Needs a published release in dev.
// Skipped unless PREVIEW_URL is set. Previews sit behind Vercel Authentication, so run it with the
// linked project's development OIDC token, which only goes to the preview's own origin:
//   vercel env run -- sh -c 'PREVIEW_URL=https://<preview> npx playwright test tests/gate-journey.spec.ts'
const PREVIEW = process.env.PREVIEW_URL;
const OIDC = process.env.VERCEL_OIDC_TOKEN;

test.skip(!PREVIEW, 'set PREVIEW_URL to run the journey against a preview');
test.describe.configure({ mode: 'serial' });

const protection = (): Record<string, string> => (OIDC ? { 'x-vercel-trusted-oidc-idp-token': OIDC } : {});

/**
 * Adds the protection header to requests for the preview, and asks /api/signup to capture the
 * email. Returns the captured emails as the signup responses carry them.
 */
async function authorise(page: Page) {
  const origin = new URL(PREVIEW!).origin;
  const inbox: Array<{ status: number; body: { captured?: { to: string; subject: string; text: string } } }> = [];
  await page.route(
    (url) => url.origin === origin,
    async (route) => {
      const headers = { ...route.request().headers(), ...protection() };
      if (new URL(route.request().url()).pathname !== '/api/signup') return route.continue({ headers });
      const response = await route.fetch({ headers: { ...headers, 'x-capture-email': '1' } });
      inbox.push({ status: response.status(), body: await response.json() });
      return route.fulfill({ response });
    },
  );
  return inbox;
}

let tokenPath = '';

test('form → captured email → token page → download, and the retry link downloads again', async ({ page }) => {
  const inbox = await authorise(page);
  await page.goto('/download/');
  const email = `gate-journey+${Date.now()}@example.com`;
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Development').check();
  await page.getByRole('button', { name: 'Send Download Link' }).click();

  await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();
  expect(inbox.map((m) => m.status)).toEqual([200]);
  const captured = inbox[0].body.captured!;
  expect(captured.to).toBe(email);
  expect(captured.subject).toBe('Your CacheDrop download link');

  const link = new URL(captured.text.match(/https:\/\/\S+\/download\/[A-Za-z0-9_-]{43}\//)[0]);
  expect(link.hostname).toMatch(/\.vercel\.app$/);
  tokenPath = link.pathname;

  const first = page.waitForEvent('download');
  await page.goto(tokenPath);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your download has started.');
  const filename = (await first).suggestedFilename();
  expect(filename).toMatch(/^CacheDrop-\d+\.\d+\.\d+\.dmg$/);
  await expect(page.locator('[data-filename]').first()).toHaveText(filename);

  const second = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download didn’t start? Try again' }).click();
  expect((await second).suggestedFilename()).toBe(filename);
});

test('the signed URL expires after 60 seconds, and the DMG is not public', async ({ request }) => {
  test.skip(!tokenPath, 'needs the token from the journey above');
  test.setTimeout(120_000);
  const token = tokenPath.split('/')[2];
  const start = await request.get(`/api/download?token=${token}`, { headers: protection(), maxRedirects: 0 });
  expect(start.status()).toBe(302);
  const signed = new URL(start.headers().location);

  expect((await request.get(signed.href)).status()).toBe(200);
  const unsigned = new URL(signed.pathname.replace('/object/sign/', '/object/public/'), signed.origin);
  expect((await request.get(unsigned.href)).status()).not.toBe(200);
  expect((await request.get(new URL(signed.pathname.replace('/object/sign/', '/object/'), signed.origin).href)).status()).not.toBe(200);

  await new Promise((r) => setTimeout(r, 61_000));
  expect((await request.get(signed.href)).status()).not.toBe(200);
});

test('an unknown token gets no file', async ({ request }) => {
  const res = await request.get(`/api/download?token=${'A'.repeat(43)}`, { headers: protection(), maxRedirects: 0 });
  expect(res.status()).toBe(404);
});
