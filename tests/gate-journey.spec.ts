import { createHash } from 'node:crypto';
import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// The email gate end to end on a Vercel preview (Decision 27): form → captured email → token page
// → download response, against the dev Supabase project. Needs a published release in dev.
// Skipped unless PREVIEW_URL is set. Previews sit behind Vercel Authentication, so run it with the
// linked project's development OIDC token, which only goes to the preview's own origin:
//   vercel env run -- sh -c 'PREVIEW_URL=https://<preview> npx playwright test tests/gate-journey.spec.ts'
// The repeat-email and day-8 checks also read the dev database: add SUPABASE_URL and
// SUPABASE_SECRET_KEY for cachedrop-dev (never prod), e.g. `node --env-file=.env.local
// node_modules/.bin/playwright test ...` inside `vercel env run`. Without them those checks skip.
const PREVIEW = process.env.PREVIEW_URL;
const OIDC = process.env.VERCEL_OIDC_TOKEN;
const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
const dev =
  SUPABASE_URL && SUPABASE_SECRET_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;
const DAY = 24 * 60 * 60 * 1000;

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
const emails: string[] = [];
const newEmail = (name: string) => {
  const email = `gate-journey+${name}-${Date.now()}@example.com`;
  emails.push(email);
  return email;
};
const LINK = /https:\/\/\S+\/download\/([A-Za-z0-9_-]{43})\//;

test.afterAll(async () => {
  if (dev && emails.length) await dev.from('signups').delete().in('email', emails);
});

/** Submits the /download/ form and returns the token from the captured email. */
async function requestLink(page: Page, inbox: Awaited<ReturnType<typeof authorise>>, email: string, news = false) {
  const before = inbox.length;
  await page.getByLabel('Email', { exact: true }).fill(email);
  if (news) await page.getByRole('checkbox', { name: /^Email me news about CacheDrop/ }).check();
  await page.getByRole('button', { name: 'Send Download Link' }).click();
  await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();
  expect(inbox.slice(before).map((m) => m.status)).toEqual([200]);
  const captured = inbox[inbox.length - 1].body.captured!;
  expect(captured.to).toBe(email);
  return captured.text.match(LINK)![1];
}

/** Opens a token's link and waits for its download to start. */
async function downloads(page: Page, token: string) {
  const download = page.waitForEvent('download');
  await page.goto(`/download/${token}/`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your download has started.');
  return (await download).suggestedFilename();
}

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

test('the same email twice: one signup, two emails, both links work, and a later tick opts in', async ({ page }) => {
  test.skip(!dev, 'needs the dev database to count signups');
  const inbox = await authorise(page);
  const email = newEmail('repeat');
  await page.goto('/download/');
  const first = await requestLink(page, inbox, email);
  await page.getByRole('button', { name: 'Use a Different Email' }).click();
  const second = await requestLink(page, inbox, email, true);
  expect(second).not.toBe(first);

  const { data } = await dev!.from('signups').select('id, news_opt_in, news_opt_in_at').eq('email', email);
  expect(data).toHaveLength(1);
  expect(data![0].news_opt_in).toBe(true);
  expect(data![0].news_opt_in_at).not.toBeNull();

  expect(await downloads(page, first)).toMatch(/^CacheDrop-\d+\.\d+\.\d+\.dmg$/);
  expect(await downloads(page, second)).toMatch(/^CacheDrop-\d+\.\d+\.\d+\.dmg$/);
});

test('a day-8 link shows the expired state, and the new link from it works', async ({ page }) => {
  test.skip(!dev, 'needs the dev database to age a token');
  const inbox = await authorise(page);
  const email = newEmail('day8');
  await page.goto('/download/');
  const old = await requestLink(page, inbox, email);
  const hash = createHash('sha256').update(old).digest('hex');
  const now = Date.now();
  const aged = await dev!
    .from('download_tokens')
    .update({ created_at: new Date(now - 8 * DAY).toISOString(), expires_at: new Date(now - DAY).toISOString() })
    .eq('token_hash', hash)
    .select('token_hash');
  expect(aged.data).toHaveLength(1);

  await page.goto(`/download/${old}/`);
  await expect(page).toHaveURL(/\/download\/\?link=expired$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('This link has expired.');
  const fresh = await requestLink(page, inbox, email);
  expect(await downloads(page, fresh)).toMatch(/^CacheDrop-\d+\.\d+\.\d+\.dmg$/);
});

test('an unknown link shows the expired state with the form', async ({ page }) => {
  await authorise(page);
  await page.goto(`/download/${'A'.repeat(43)}/`);
  await expect(page).toHaveURL(/\/download\/\?link=expired$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('This link has expired.');
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
});

test('an unknown token gets no file', async ({ request }) => {
  const res = await request.get(`/api/download?token=${'A'.repeat(43)}`, { headers: protection(), maxRedirects: 0 });
  expect(res.status()).toBe(404);
});
