import { test, expect, type Page } from '@playwright/test';

// The bot check on both forms (Decision 12) against the static build, with the functions mocked
// and Cloudflare's real Turnstile running on its test site keys. The build embeds the always-pass
// key; a test swaps in another key by rewriting the page. Server-side refusals (always-fail and
// spent secrets) are covered by src/server/*.test.ts and, on a preview, the journey specs.
const DUMMY = 'XXXX.DUMMY.TOKEN.XXXX';
const KEYS = { pass: '1x00000000000000000000AA', block: '2x00000000000000000000AB', interactive: '3x00000000000000000000FF' };
const CLOUDFLARE = 'https://challenges.cloudflare.com/turnstile/';
const FAILED = 'We couldn’t confirm this came from a person. Reload the page and try again.';
const FAILED_FR = 'Nous n’avons pas pu confirmer que l’envoi vient d’une personne. Rechargez la page et réessayez.';

/** Serves the built pages with another Turnstile site key in them. */
async function useSiteKey(page: Page, key: string) {
  await page.route(
    (url) => url.pathname.endsWith('/') && !url.href.startsWith(CLOUDFLARE),
    async (route) => {
      const response = await route.fetch();
      const body = (await response.text()).replaceAll(`data-sitekey="${KEYS.pass}"`, `data-sitekey="${key}"`);
      await route.fulfill({ response, body });
    },
  );
}

/** Records what a form posts to `api` and answers with `status` and `body`. */
async function mock(page: Page, api: string, status = 200, body: object = { ok: true }, headers: Record<string, string> = {}) {
  const sent: Array<Record<string, unknown>> = [];
  await page.route(`**${api}`, async (route) => {
    sent.push(route.request().postDataJSON());
    await route.fulfill({ status, json: body, headers });
  });
  return sent;
}

const cloudflareLoads = (page: Page) => {
  const loads: string[] = [];
  page.on('request', (r) => {
    if (r.url().startsWith(CLOUDFLARE)) loads.push(r.url());
  });
  return loads;
};

test.describe("Cloudflare's script", () => {
  test('loads on /download/, where the form is', async ({ page }) => {
    const loads = cloudflareLoads(page);
    await page.goto('/download/');
    await expect.poll(() => loads.length).toBeGreaterThan(0);
  });

  test('loads on other pages only once the feedback modal opens', async ({ page }) => {
    const loads = cloudflareLoads(page);
    await page.goto('/clear-mac-developer-caches/');
    await page.waitForLoadState('networkidle');
    expect(loads).toEqual([]);
    await page.locator('[data-feedback]').first().click();
    await expect.poll(() => loads.length).toBeGreaterThan(0);
  });
});

async function sendSignup(page: Page) {
  await page.getByLabel('Email', { exact: true }).fill('ada@example.com');
  await page.getByRole('button', { name: 'Send Download Link' }).click();
}

test.describe('the download form', () => {
  test('sends the Turnstile token, with nothing to click in the normal case', async ({ page }) => {
    const sent = await mock(page, '/api/signup');
    await page.goto('/download/');
    await sendSignup(page);
    await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();
    expect(sent).toEqual([{ email: 'ada@example.com', filling: null, news: false, lang: 'en', turnstile: DUMMY }]);
    await expect(page.locator('[data-gate-form] [data-bot-check]')).toBeHidden();
  });

  test('says so calmly when the function refuses the bot check, and can send again', async ({ page }) => {
    const sent = await mock(page, '/api/signup', 403, { error: 'bot_check' });
    await page.goto('/download/');
    await sendSignup(page);
    await expect(page.getByRole('alert')).toHaveText(FAILED);
    await expect(page.getByLabel('Email', { exact: true })).not.toHaveAttribute('aria-invalid');
    await page.getByRole('button', { name: 'Send Download Link' }).click();
    await expect.poll(() => sent.length).toBe(2);
    expect(sent[1].turnstile).toBe(DUMMY);
  });

  test('says how long to wait when the place is rate-limited', async ({ page }) => {
    await mock(page, '/api/signup', 429, { error: 'rate_limited', retryAfter: 1150 }, { 'retry-after': '1150' });
    await page.goto('/download/');
    await sendSignup(page);
    await expect(page.getByRole('alert')).toHaveText('That’s a lot of tries from your network. Try again in 20 minutes.');
  });

  test('sends nothing when the check fails in the browser (always-block key)', async ({ page }) => {
    await useSiteKey(page, KEYS.block);
    const sent = await mock(page, '/api/signup');
    await page.goto('/download/');
    await sendSignup(page);
    await expect(page.getByRole('alert')).toHaveText(FAILED);
    await expect(page.getByRole('button', { name: 'Send Download Link' })).toBeEnabled();
    expect(sent).toEqual([]);
  });

  test('shows the Turnstile box only when Cloudflare needs a click (force-interactive key)', async ({ page }) => {
    await useSiteKey(page, KEYS.interactive);
    await page.goto('/download/');
    await expect(page.locator('[data-gate-form] [data-bot-check]')).toBeVisible();
  });
});

async function openFeedback(page: Page) {
  await page.goto('/clear-mac-developer-caches/');
  await page.locator('[data-feedback]').first().click();
  await page.getByLabel('What should we change?').fill('More guides please');
}

test.describe('the feedback modal', () => {
  test('sends the Turnstile token', async ({ page }) => {
    const sent = await mock(page, '/api/feedback');
    await openFeedback(page);
    await page.getByRole('button', { name: 'Submit Feedback' }).click();
    await expect(page.getByText('Thanks, that helps.')).toBeVisible();
    expect(sent).toEqual([{ rating: null, email: '', message: 'More guides please', page: '/clear-mac-developer-caches/', specs: null, turnstile: DUMMY }]);
  });

  test('says so calmly when the function refuses the bot check', async ({ page }) => {
    await mock(page, '/api/feedback', 403, { error: 'bot_check' });
    await openFeedback(page);
    await page.getByRole('button', { name: 'Submit Feedback' }).click();
    await expect(page.getByRole('alert')).toHaveText(FAILED);
  });

  test('says how long to wait when the place is rate-limited', async ({ page }) => {
    await mock(page, '/api/feedback', 429, { error: 'rate_limited', retryAfter: 30 }, { 'retry-after': '30' });
    await openFeedback(page);
    await page.getByRole('button', { name: 'Submit Feedback' }).click();
    await expect(page.getByRole('alert')).toHaveText('That’s a lot of tries from your network. Try again in a minute.');
  });

  test('sends nothing when the check fails in the browser (always-block key)', async ({ page }) => {
    await useSiteKey(page, KEYS.block);
    const sent = await mock(page, '/api/feedback');
    await openFeedback(page);
    await page.getByRole('button', { name: 'Submit Feedback' }).click();
    await expect(page.getByRole('alert')).toHaveText(FAILED);
    expect(sent).toEqual([]);
  });
});

// The same states on the French pages (Decision 5): the widget's copy comes from the page's language.
async function sendSignupFr(page: Page) {
  await page.getByLabel('Courriel', { exact: true }).fill('ada@example.com');
  await page.getByRole('button', { name: 'Envoyer le lien de téléchargement' }).click();
}

test.describe('the French download form', () => {
  test('sends the Turnstile token with lang: "fr"', async ({ page }) => {
    const sent = await mock(page, '/api/signup');
    await page.goto('/fr/download/');
    await sendSignupFr(page);
    await expect(page.getByRole('heading', { name: 'Vérifiez vos courriels' })).toBeVisible();
    expect(sent).toEqual([{ email: 'ada@example.com', filling: null, news: false, lang: 'fr', turnstile: DUMMY }]);
  });

  test('says in French when the function refuses the bot check', async ({ page }) => {
    await mock(page, '/api/signup', 403, { error: 'bot_check' });
    await page.goto('/fr/download/');
    await sendSignupFr(page);
    await expect(page.getByRole('alert')).toHaveText(FAILED_FR);
  });

  test('says in French how long to wait when the place is rate-limited', async ({ page }) => {
    await mock(page, '/api/signup', 429, { error: 'rate_limited', retryAfter: 1150 }, { 'retry-after': '1150' });
    await page.goto('/fr/download/');
    await sendSignupFr(page);
    await expect(page.getByRole('alert')).toHaveText('Il y a eu beaucoup d’essais à partir de votre réseau. Réessayez dans 20\u00a0minutes.');
  });

  test('sends nothing and says so in French when the check fails in the browser (always-block key)', async ({ page }) => {
    await useSiteKey(page, KEYS.block);
    const sent = await mock(page, '/api/signup');
    await page.goto('/fr/download/');
    await sendSignupFr(page);
    await expect(page.getByRole('alert')).toHaveText(FAILED_FR);
    expect(sent).toEqual([]);
  });
});

async function openFeedbackFr(page: Page) {
  await page.goto('/fr/clear-mac-developer-caches/');
  await page.locator('[data-feedback]').first().click();
  await page.getByLabel('Que devrions-nous changer?').fill('Plus de guides');
}

test.describe('the French feedback modal', () => {
  test('sends the Turnstile token', async ({ page }) => {
    const sent = await mock(page, '/api/feedback');
    await openFeedbackFr(page);
    await page.getByRole('button', { name: 'Envoyer mon avis' }).click();
    await expect(page.getByText('Merci, ça nous aide.')).toBeVisible();
    expect(sent).toEqual([{ rating: null, email: '', message: 'Plus de guides', page: '/fr/clear-mac-developer-caches/', specs: null, turnstile: DUMMY }]);
  });

  test('says in French when the function refuses the bot check', async ({ page }) => {
    await mock(page, '/api/feedback', 403, { error: 'bot_check' });
    await openFeedbackFr(page);
    await page.getByRole('button', { name: 'Envoyer mon avis' }).click();
    await expect(page.getByRole('alert')).toHaveText(FAILED_FR);
  });

  test('says in French how long to wait when the place is rate-limited', async ({ page }) => {
    await mock(page, '/api/feedback', 429, { error: 'rate_limited', retryAfter: 30 }, { 'retry-after': '30' });
    await openFeedbackFr(page);
    await page.getByRole('button', { name: 'Envoyer mon avis' }).click();
    await expect(page.getByRole('alert')).toHaveText('Il y a eu beaucoup d’essais à partir de votre réseau. Réessayez dans une minute.');
  });

  test('says in French when a send fails for another reason', async ({ page }) => {
    await mock(page, '/api/feedback', 500, { error: 'failed' });
    await openFeedbackFr(page);
    await page.getByRole('button', { name: 'Envoyer mon avis' }).click();
    await expect(page.getByRole('alert')).toHaveText('L’envoi n’a pas fonctionné. Vérifiez votre connexion et réessayez.');
  });
});
