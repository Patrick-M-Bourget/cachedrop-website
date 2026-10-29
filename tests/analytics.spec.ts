import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pages } from './pages';

// Decision 16: Vercel Web Analytics counts page views without cookies, and no download token
// ever reaches it. The seam is what Vercel's own script sends: the static build serves no
// /_vercel/insights/script.js, so each test serves a copy of Vercel's published script there and
// records the page views it posts to /_vercel/insights/view. public/assets/analytics.js redacts.
// The copy is https://va.vercel-scripts.com/v1/script.js as of 2026-10-29 (the CDN challenges
// scripted fetches, so tests can't fetch it live). Refresh it with curl if Vercel changes it.

const VERCEL_SCRIPT = 'tests/fixtures/vercel-insights-script.js';
const TOKEN = 'q3Zb8_Xv-2LkPw0e9RtYhUjA1sDfGhJkL4zXcVbNm7Q';
expect(TOKEN).toMatch(/^[A-Za-z0-9_-]{43}$/);

let vercelScript: string | undefined;

/** Serves Vercel's script and returns the page views it sends, as raw request bodies. */
async function recordViews(page: Page) {
  const views: string[] = [];
  // Vercel's script ignores automated browsers; look like a person so it sends.
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }));
  await page.route('**/_vercel/insights/script.js', async (route) => {
    vercelScript ??= await readFile(VERCEL_SCRIPT, 'utf8');
    await route.fulfill({ body: vercelScript, contentType: 'text/javascript' });
  });
  await page.route('**/_vercel/insights/view', async (route) => {
    views.push(route.request().postData() ?? '');
    await route.fulfill({ status: 200, body: 'OK' });
  });
  return views;
}

/** Waits for `count` page views, then checks none of them carries the token anywhere. */
async function viewsWithoutToken(views: string[], count: number) {
  await expect.poll(() => views.length).toBe(count);
  for (const body of views) expect(body).not.toContain(TOKEN);
  return views.map((body) => JSON.parse(body) as { o: string; r?: string });
}

/** Serves the built token page at /download/<token>/, as vercel.json's rewrite does. */
async function serveTokenPage(page: Page, release: { status: number; json?: object }) {
  await page.route(/\/download\/[A-Za-z0-9_-]{43}\/$/, async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({ response: await route.fetch({ url: `${url.origin}/download/link/` }) });
  });
  await page.route('**/api/release?*', (route) => route.fulfill(release));
  await page.route('**/api/download?*', (route) =>
    route.fulfill({ body: 'dmg', headers: { 'content-disposition': 'attachment; filename=CacheDrop-1.2.0.dmg' } }),
  );
}

test.describe('every page counts one page view at its own address, without cookies', () => {
  for (const p of pages) {
    test(`on ${p.path}`, async ({ page, context, baseURL }) => {
      const views = await recordViews(page);
      await page.goto(p.path);
      const [view] = await viewsWithoutToken(views, 1);
      expect(view.o).toBe(new URL(p.path, baseURL).href);
      expect(await context.cookies()).toEqual([]);
    });
  }
});

test.describe('no download token reaches analytics', () => {
  test('from the token page, which counts as /download/[token]/', async ({ page, baseURL }) => {
    const views = await recordViews(page);
    await serveTokenPage(page, { status: 200, json: { version: '1.2.0', filename: 'CacheDrop-1.2.0.dmg' } });
    const download = page.waitForEvent('download');
    await page.goto(`/download/${TOKEN}/`);
    await download;
    const [view] = await viewsWithoutToken(views, 1);
    expect(view.o).toBe(`${baseURL}/download/[token]/`);
  });

  test('from the token page without its trailing slash', async ({ page, baseURL }) => {
    const views = await recordViews(page);
    await page.route(`**/download/${TOKEN}`, async (route) => {
      const url = new URL(route.request().url());
      await route.fulfill({ response: await route.fetch({ url: `${url.origin}/download/link/` }) });
    });
    await page.route('**/api/**', (route) => route.abort());
    await page.goto(`/download/${TOKEN}`);
    const [view] = await viewsWithoutToken(views, 1);
    expect(view.o).toBe(`${baseURL}/download/[token]`);
  });

  test('from a query string or a fragment', async ({ page, baseURL }) => {
    const views = await recordViews(page);
    await page.goto(`/download/?token=${TOKEN}&utm_source=newsletter#${TOKEN}`);
    const [view] = await viewsWithoutToken(views, 1);
    expect(view.o).toBe(`${baseURL}/download/?utm_source=newsletter`);
  });

  test('from a query value that looks like a token', async ({ page }) => {
    const views = await recordViews(page);
    await page.goto(`/?utm_content=${TOKEN}`);
    await viewsWithoutToken(views, 1);
  });

  test('from the referrer of a page reached from another site', async ({ page }) => {
    const views = await recordViews(page);
    await page.goto('/', { referer: `https://mail.example.com/read/download/${TOKEN}/?token=${TOKEN}` });
    expect(await page.evaluate(() => document.referrer)).not.toContain(TOKEN);
    const [view] = await viewsWithoutToken(views, 1);
    expect(view.r).toBe('https://mail.example.com/read/download/[token]/');
  });

  test('from the referrer of a page reached from the token page', async ({ page }) => {
    const views = await recordViews(page);
    await serveTokenPage(page, { status: 200, json: { version: '1.2.0', filename: 'CacheDrop-1.2.0.dmg' } });
    const download = page.waitForEvent('download');
    await page.goto(`/download/${TOKEN}/`);
    await download;
    await page.getByRole('link', { name: 'Clear Developer Caches guide' }).click();
    await expect(page).toHaveURL(/\/clear-mac-developer-caches\/$/);
    expect(await page.evaluate(() => document.referrer)).not.toContain(TOKEN);
    await viewsWithoutToken(views, 2);
  });

  for (const status of [404, 410]) {
    test(`from the client-side redirect of a ${status} link to the form`, async ({ page, baseURL }) => {
      const views = await recordViews(page);
      await serveTokenPage(page, { status, json: { error: 'gone' } });
      await page.goto(`/download/${TOKEN}/`);
      // #9: a dead link lands on the form's expired state. Only utm_* parameters are reported.
      const form = `${baseURL}/download/`;
      await expect(page).toHaveURL(/\/download\/\?link=expired$/);
      expect(await page.evaluate(() => document.referrer)).not.toContain(TOKEN);
      // The token page may redirect before its own page view goes out; either way, no token.
      await expect.poll(() => views.some((body) => JSON.parse(body).o === form)).toBe(true);
      const sent = await viewsWithoutToken(views, views.length);
      for (const v of sent) expect([`${baseURL}/download/[token]/`, form]).toContain(v.o);
    });
  }
});
