import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

// The French download form, token page and unsubscribe page (Decision 5), against the static
// build with the functions mocked, as download.spec.ts and unsubscribe.spec.ts do in English.
// The emails #14 sends in French link to /fr/download/<token>/ and /fr/unsubscribe/<token>/.
const TOKEN = 'T'.repeat(43);

async function mockSignup(page: Page, status = 200, body: object = { ok: true }) {
  const requests: unknown[] = [];
  await page.route('**/api/signup', async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status, json: body });
  });
  return requests;
}

/** Serves a built page at `<prefix>/<token>/`, as vercel.json's rewrite does on Vercel. */
async function serveAtToken(page: Page, prefix: string, built: string) {
  await page.route(new RegExp(`${prefix}/[A-Za-z0-9_-]{43}/$`), async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({ response: await route.fetch({ url: `${url.origin}${built}` }) });
  });
}

test.describe('the French download form', () => {
  test('asks for an email in French and sends lang: "fr" with the signup', async ({ page }) => {
    const requests = await mockSignup(page);
    await page.goto('/fr/download/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Obtenez la bêta de CacheDrop.');
    await page.getByLabel('Courriel', { exact: true }).fill('ada@example.com');
    await page.getByRole('radio', { name: 'Développement' }).check();
    await page.getByRole('button', { name: 'Envoyer le lien de téléchargement' }).click();
    await expect(page.getByRole('heading', { name: 'Vérifiez vos courriels' })).toBeFocused();
    expect(requests).toEqual([{ email: 'ada@example.com', filling: 'development', news: false, lang: 'fr', turnstile: 'XXXX.DUMMY.TOKEN.XXXX' }]);
  });

  test('explains an incomplete email in French', async ({ page }) => {
    const requests = await mockSignup(page);
    await page.goto('/fr/download/');
    await page.getByLabel('Courriel', { exact: true }).fill('ada@');
    await page.getByRole('button', { name: 'Envoyer le lien de téléchargement' }).click();
    await expect(page.getByRole('alert')).toHaveText('Entrez une adresse courriel complète, comme vous@exemple.com.');
    expect(requests).toEqual([]);
  });

  test('says in French when the link could not be sent', async ({ page }) => {
    await mockSignup(page, 500, { error: 'send_failed' });
    await page.goto('/fr/download/');
    await page.getByLabel('Courriel', { exact: true }).fill('ada@example.com');
    await page.getByRole('button', { name: 'Envoyer le lien de téléchargement' }).click();
    await expect(page.getByRole('alert')).toHaveText('Le lien n’a pas pu être envoyé. Vérifiez votre connexion et réessayez.');
  });

  test('links to the French privacy policy', async ({ page }) => {
    await page.goto('/fr/download/');
    await expect(page.locator('form').getByRole('link', { name: 'Politique de confidentialité' })).toHaveAttribute('href', '/fr/privacy/');
  });
});

test.describe('the French token page', () => {
  test('starts the download from /fr/download/<token>/ and says so in French', async ({ page }) => {
    await serveAtToken(page, '/fr/download', '/fr/download/link/');
    await page.route('**/api/release?*', (route) => route.fulfill({ status: 200, json: { version: '1.2.0', filename: 'CacheDrop-1.2.0.dmg' } }));
    await page.route('**/api/download?*', (route) =>
      route.fulfill({ body: 'dmg', headers: { 'content-type': 'application/x-apple-diskimage', 'content-disposition': 'attachment; filename=CacheDrop-1.2.0.dmg' } }),
    );
    const download = page.waitForEvent('download');
    await page.goto(`/fr/download/${TOKEN}/`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Votre téléchargement a commencé.');
    await download;
    await expect(page.getByRole('link', { name: 'Le téléchargement n’a pas commencé? Réessayez' })).toHaveAttribute('href', `/api/download?token=${TOKEN}`);
  });

  test('sends an expired link to the French form, which says it has expired', async ({ page }) => {
    await serveAtToken(page, '/fr/download', '/fr/download/link/');
    await page.route('**/api/release?*', (route) => route.fulfill({ status: 410, json: { error: 'expired' } }));
    const requests = await mockSignup(page);
    await page.goto(`/fr/download/${TOKEN}/`);
    await expect(page).toHaveURL(/\/fr\/download\/\?link=expired$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ce lien a expiré.');
    await page.getByLabel('Courriel', { exact: true }).fill('ada@example.com');
    await page.getByRole('button', { name: 'Envoyer le lien de téléchargement' }).click();
    await expect(page.getByRole('heading', { name: 'Vérifiez vos courriels' })).toBeVisible();
    expect(requests).toEqual([{ email: 'ada@example.com', filling: null, news: false, lang: 'fr', turnstile: 'XXXX.DUMMY.TOKEN.XXXX' }]);
  });
});

test.describe('the French unsubscribe page', () => {
  test('unsubscribes from /fr/unsubscribe/<token>/ and confirms in French', async ({ page }) => {
    await serveAtToken(page, '/fr/unsubscribe', '/fr/unsubscribe/');
    const calls: string[] = [];
    await page.route('**/api/unsubscribe?*', async (route) => {
      calls.push(`${route.request().method()} ${route.request().url()}`);
      await route.fulfill({ status: 200, body: '' });
    });
    await page.goto(`/fr/unsubscribe/${TOKEN}/`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Désabonnement confirmé.');
    expect(calls).toEqual([expect.stringMatching(new RegExp(`^POST .*/api/unsubscribe\\?token=${TOKEN}$`))]);
  });

  test('says in French that a link without a token doesn’t work', async ({ page }) => {
    await page.goto('/fr/unsubscribe/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ce lien de désabonnement ne fonctionne pas.');
  });
});

test('vercel.json serves the French emailed links (#14) from the French pages', async () => {
  const { rewrites } = JSON.parse(await readFile('vercel.json', 'utf8')) as { rewrites: Array<{ source: string; destination: string }> };
  const route = (path: string) =>
    rewrites.find((r) => new RegExp(`^${r.source.replace(/:token\(([^)]+)\)/, '$1')}$`).test(path))?.destination;
  for (const slash of ['/', '']) {
    expect(route(`/fr/download/${TOKEN}${slash}`)).toBe('/fr/download/link/');
    expect(route(`/fr/unsubscribe/${TOKEN}${slash}`)).toBe('/fr/unsubscribe/');
    expect(route(`/download/${TOKEN}${slash}`)).toBe('/download/link/');
  }
});
