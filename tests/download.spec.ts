import { test, expect, type Page } from '@playwright/test';
import { pages, uiOf } from './pages';

// The email gate's pages (Decisions 1, 2) against the static build, with the Vercel functions
// mocked. tests/gate-journey.spec.ts runs the real thing against a preview.

const TOKEN = 'T'.repeat(43);
const NEWS = 'Email me news about CacheDrop, like new features and surveys.';
// The token Cloudflare's always-pass test site key gives (the build's key outside Production; Decision 12).
const turnstile = 'XXXX.DUMMY.TOKEN.XXXX';

test.describe('every Download button leads to the form', () => {
  for (const p of pages.filter((p) => !/^(\/fr)?\/download\//.test(p.path))) {
    test(`on ${p.path}`, async ({ page }) => {
      await page.goto(p.path);
      const links = page.locator('a', { hasText: /download|télécharg|try cachedrop|essayer cachedrop/i });
      const hrefs = await links.evaluateAll((as) => as.map((a) => a.getAttribute('href')));
      expect(hrefs.length).toBeGreaterThan(0);
      for (const href of hrefs) expect(href).toBe(uiOf(p).download);
    });
  }

  test('and the form asks for an email', async ({ page }) => {
    await page.goto('/download/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Download CacheDrop for Mac.');
    await expect(page.getByText('We’ll email your download link and let you know when updates are ready.')).toBeVisible();
    // The trial is stated once, in the email (Decision 51), so the page's meta line doesn't.
    await expect(page.getByText('Universal: Apple Silicon & Intel')).toBeVisible();
    await expect(page.getByText(/free to try/i)).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Uninstall Audio Plug-ins guide' })).toHaveAttribute('href', '/uninstall-audio-plugins-mac/');
    await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
    await expect(page.getByRole('radio')).toHaveCount(4);
    await expect(page.getByRole('radio', { checked: true })).toHaveCount(0);
  });
});

/** Records signup requests and answers them with `status` and `body`. */
async function mockSignup(page: Page, status = 200, body: object = { ok: true }) {
  const requests: unknown[] = [];
  await page.route('**/api/signup', async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status, json: body });
  });
  return requests;
}

test.describe('the form', () => {
  test('sends the email and the answer once, then says to check the inbox', async ({ page }) => {
    const requests = await mockSignup(page);
    await page.goto('/download/');
    await page.getByLabel('Email', { exact: true }).fill(' ada@example.com ');
    await page.getByLabel('Video & photo').check();
    await page.getByRole('button', { name: 'Email Me the Link' }).click();

    await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeFocused();
    await expect(page.getByText('We sent a download link to ada@example.com.')).toBeVisible();
    await expect(page.getByLabel('Email', { exact: true })).toBeHidden();
    expect(requests).toEqual([{ email: 'ada@example.com', filling: 'video-photo', news: false, lang: 'en', turnstile }]);
  });

  test('sends no answer when the question is skipped', async ({ page }) => {
    const requests = await mockSignup(page);
    await page.goto('/download/');
    await page.getByLabel('Email', { exact: true }).fill('ada@example.com');
    await page.getByLabel('Email', { exact: true }).press('Enter');
    await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();
    expect(requests).toEqual([{ email: 'ada@example.com', filling: null, news: false, lang: 'en', turnstile }]);
  });

  test('catches an incomplete email before sending anything', async ({ page }) => {
    const requests = await mockSignup(page);
    await page.goto('/download/');
    await page.getByLabel('Email', { exact: true }).fill('ada@example');
    await page.getByRole('button', { name: 'Email Me the Link' }).click();
    await expect(page.getByRole('alert')).toHaveText('Enter a full email address, like you@example.com.');
    await expect(page.getByLabel('Email', { exact: true })).toHaveAttribute('aria-invalid', 'true');
    expect(requests).toEqual([]);
  });

  test('shows the server refusing the email as a field error', async ({ page }) => {
    await mockSignup(page, 400, { error: 'invalid_email' });
    await page.goto('/download/');
    await page.getByLabel('Email', { exact: true }).fill('ada@example.com');
    await page.getByRole('button', { name: 'Email Me the Link' }).click();
    await expect(page.getByRole('alert')).toHaveText('Enter a full email address, like you@example.com.');
  });

  test('keeps the form and offers a retry when the email could not be sent', async ({ page }) => {
    await mockSignup(page, 502, { error: 'email_failed' });
    await page.goto('/download/');
    await page.getByLabel('Email', { exact: true }).fill('ada@example.com');
    await page.getByRole('button', { name: 'Email Me the Link' }).click();
    await expect(page.getByRole('alert')).toHaveText('We couldn’t send the link. Check your connection and try again.');
    await expect(page.getByRole('button', { name: 'Email Me the Link' })).toBeEnabled();
  });

  test('"Use a Different Email" brings the form back', async ({ page }) => {
    await mockSignup(page);
    await page.goto('/download/');
    await page.getByLabel('Email', { exact: true }).fill('ada@example.com');
    await page.getByRole('button', { name: 'Email Me the Link' }).click();
    await page.getByRole('button', { name: 'Use a Different Email' }).click();
    await expect(page.getByLabel('Email', { exact: true })).toBeFocused();
    await expect(page.getByLabel('Email', { exact: true })).toHaveValue('');
  });

  // Decision 53: the done state opens the inbox and sends the email again.
  test('the done state opens Gmail and Outlook in a new tab', async ({ page }) => {
    await mockSignup(page);
    await page.goto('/download/');
    await page.getByLabel('Email', { exact: true }).fill('ada+mac@example.com');
    await page.getByRole('button', { name: 'Email Me the Link' }).click();
    const gmail = page.getByRole('link', { name: 'Open Gmail' });
    const outlook = page.getByRole('link', { name: 'Open Outlook' });
    await expect(gmail).toBeVisible();
    await expect(outlook).toBeVisible();
    // Gmail opens the account that was typed and searches every folder, spam included, for the sender.
    await expect(gmail).toHaveAttribute('href', 'https://mail.google.com/mail/u/?authuser=ada%2Bmac%40example.com#search/from%3Ahello%40cachedrop.io+in%3Aanywhere');
    await expect(outlook).toHaveAttribute('href', 'https://outlook.live.com/mail/0/');
    for (const link of [gmail, outlook]) {
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  test('"Send it again" sends the same signup again and says so', async ({ page }) => {
    const requests = await mockSignup(page);
    await page.goto('/download/');
    await page.getByLabel('Email', { exact: true }).fill('ada@example.com');
    await page.getByLabel('Development').check();
    await page.getByRole('button', { name: 'Email Me the Link' }).click();
    await expect(page.getByText('Didn’t get it?')).toBeVisible();
    await page.getByRole('button', { name: 'Send it again' }).click();
    await expect(page.getByRole('status')).toHaveText('Sent again. It can take a minute to arrive.');
    await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();
    const sent = { email: 'ada@example.com', filling: 'development', news: false, lang: 'en', turnstile };
    expect(requests).toEqual([sent, sent]);
  });

  test('"Send it again" says why when the second email could not be sent', async ({ page }) => {
    let calls = 0;
    await page.route('**/api/signup', (route) => route.fulfill(++calls === 1 ? { json: { ok: true } } : { status: 502, json: { error: 'email_failed' } }));
    await page.goto('/download/');
    await page.getByLabel('Email', { exact: true }).fill('ada@example.com');
    await page.getByRole('button', { name: 'Email Me the Link' }).click();
    await page.getByRole('button', { name: 'Send it again' }).click();
    await expect(page.getByRole('status')).toHaveText('We couldn’t send the link. Check your connection and try again.');
    await expect(page.getByRole('button', { name: 'Send it again' })).toBeEnabled();
  });

  test('offers the news opt-in unticked, and the download never depends on it (Decision 3)', async ({ page }) => {
    const requests = await mockSignup(page);
    await page.goto('/download/');
    const news = page.getByRole('checkbox', { name: NEWS, exact: true });
    await expect(news).not.toBeChecked();
    await expect(news).toHaveAccessibleDescription('Optional. You can unsubscribe at any time from any of our emails.');
    await page.getByLabel('Email', { exact: true }).fill('ada@example.com');
    await page.getByRole('button', { name: 'Email Me the Link' }).click();
    await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();
    expect(requests).toEqual([{ email: 'ada@example.com', filling: null, news: false, lang: 'en', turnstile }]);
  });

  test('sends news: true only when the box is ticked, and starts unticked again for a different email', async ({ page }) => {
    const requests = await mockSignup(page);
    await page.goto('/download/');
    await page.getByLabel('Email', { exact: true }).fill('ada@example.com');
    await page.getByRole('checkbox', { name: NEWS, exact: true }).check();
    await page.getByRole('button', { name: 'Email Me the Link' }).click();
    await page.getByRole('button', { name: 'Use a Different Email' }).click();
    await expect(page.getByRole('checkbox', { name: NEWS, exact: true })).not.toBeChecked();
    expect(requests).toEqual([{ email: 'ada@example.com', filling: null, news: true, lang: 'en', turnstile }]);
  });

  test('links to the privacy policy (Decision 19)', async ({ page }) => {
    await page.goto('/download/');
    await expect(page.locator('form').getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy/');
  });
});

/** Serves the built token page at /download/<token>/, as vercel.json's rewrite does. */
async function serveTokenPage(page: Page, release: { status: number; json: object }) {
  await page.route(/\/download\/[A-Za-z0-9_-]{43}\/$/, async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({ response: await route.fetch({ url: `${url.origin}/download/link/` }) });
  });
  await page.route('**/api/release?*', (route) => route.fulfill(release));
  const starts: string[] = [];
  await page.route('**/api/download?*', async (route) => {
    starts.push(route.request().url());
    await route.fulfill({
      body: 'dmg',
      headers: { 'content-type': 'application/x-apple-diskimage', 'content-disposition': 'attachment; filename=CacheDrop-1.2.0.dmg' },
    });
  });
  return starts;
}

test.describe('the token page', () => {
  test('shows the latest release and starts its download, and the retry link starts it again', async ({ page, baseURL }) => {
    const starts = await serveTokenPage(page, { status: 200, json: { version: '1.2.0', filename: 'CacheDrop-1.2.0.dmg' } });
    const first = page.waitForEvent('download');
    await page.goto(`/download/${TOKEN}/`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your download has started.');
    await expect(page.locator('[data-filename]')).toHaveText(['CacheDrop-1.2.0.dmg', 'CacheDrop-1.2.0.dmg']);
    expect((await first).suggestedFilename()).toBe('CacheDrop-1.2.0.dmg');

    const retry = page.getByRole('link', { name: 'Download didn’t start? Try again' });
    await expect(retry).toHaveAttribute('href', `/api/download?token=${TOKEN}`);
    const second = page.waitForEvent('download');
    await retry.click();
    await second;
    expect(starts).toEqual([`${baseURL}/api/download?token=${TOKEN}`, `${baseURL}/api/download?token=${TOKEN}`]);
  });

  for (const [status, error] of [[404, 'unknown'], [410, 'expired']] as const) {
    test(`shows a ${status} (${error}) link as expired, with the form to get a new one`, async ({ page }) => {
      const starts = await serveTokenPage(page, { status, json: { error } });
      const requests = await mockSignup(page);
      await page.goto(`/download/${TOKEN}/`);
      await expect(page).toHaveURL(/\/download\/\?link=expired$/);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('This link has expired.');
      await expect(page.getByText('Download links work for 7 days. Enter your email and we’ll send you a new one.')).toBeVisible();
      expect(starts).toEqual([]);

      await page.getByLabel('Email', { exact: true }).fill('ada@example.com');
      await page.getByRole('button', { name: 'Email Me the Link' }).click();
      await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();
      expect(requests).toEqual([{ email: 'ada@example.com', filling: null, news: false, lang: 'en', turnstile }]);
    });
  }

  test('keeps the token out of the address once it has expired', async ({ page }) => {
    await serveTokenPage(page, { status: 410, json: { error: 'expired' } });
    await page.goto('/');
    await page.goto(`/download/${TOKEN}/`);
    await expect(page).toHaveURL(/\/download\/\?link=expired$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
  });

  test('does nothing at its own path, where there is no token', async ({ page }) => {
    let calls = 0;
    await page.route('**/api/**', (route) => {
      calls++;
      return route.abort();
    });
    await page.goto('/download/link/');
    await page.waitForTimeout(600);
    await expect(page).toHaveURL(/\/download\/link\/$/);
    expect(calls).toBe(0);
  });
});
