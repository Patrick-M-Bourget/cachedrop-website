import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// Emails in the signup language (Decision 5, #14) on a Vercel preview: a French signup gets the
// French email with /fr/ links whose token downloads, and a later English signup switches the stored
// language back. Skipped unless PREVIEW_URL is set; run it like tests/gate-journey.spec.ts. The
// stored-language checks also need SUPABASE_URL and SUPABASE_SECRET_KEY for cachedrop-dev.
const PREVIEW = process.env.PREVIEW_URL;
const OIDC = process.env.VERCEL_OIDC_TOKEN;
const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
const dev =
  SUPABASE_URL && SUPABASE_SECRET_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;

test.skip(!PREVIEW, 'set PREVIEW_URL to run the journey against a preview');

const protection = (): Record<string, string> => (OIDC ? { 'x-vercel-trusted-oidc-idp-token': OIDC } : {});
const email = `french-email-journey+${Date.now()}@example.com`;
const emails = [email];

test.afterAll(async () => {
  if (dev) await dev.from('signups').delete().in('email', emails);
});

test('a French signup gets the French email; a later English one switches back', async ({ request }) => {
  const signup = async (lang: string) => {
    const res = await request.post('/api/signup', {
      // Previews hold Turnstile's always-pass key, and this run counts under its own rate-limit key (#12).
      headers: { ...protection(), 'x-capture-email': '1', 'x-rate-limit-key': `french-email-journey-${email}` },
      data: { email, lang, turnstile: 'XXXX.DUMMY.TOKEN.XXXX' },
    });
    expect(res.status()).toBe(200);
    return (await res.json()).captured as { subject: string; text: string; headers: Record<string, string> };
  };
  const storedLang = async () => (await dev!.from('signups').select('lang').eq('email', email).single()).data?.lang;

  const fr = await signup('fr');
  expect(fr.subject).toBe('Votre lien de téléchargement CacheDrop');
  const token = fr.text.match(/https:\/\/\S+\/fr\/download\/([A-Za-z0-9_-]{43})\//)![1];
  expect(fr.text).toMatch(/https:\/\/\S+\/fr\/unsubscribe\/[A-Za-z0-9_-]{43}\//);
  expect(fr.text).toMatch(/https:\/\/\S+\/fr\/privacy\//);
  expect(fr.headers['List-Unsubscribe']).toMatch(/^<https:\/\/\S+\/api\/unsubscribe\?token=[A-Za-z0-9_-]{43}&lang=fr>$/);
  expect(fr.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  const start = await request.get(`/api/download?token=${token}`, { headers: protection(), maxRedirects: 0 });
  expect(start.status()).toBe(302);
  if (dev) expect(await storedLang()).toBe('fr');

  const en = await signup('en');
  expect(en.subject).toBe('Your CacheDrop download link');
  expect(en.text).not.toContain('/fr/');
  if (dev) expect(await storedLang()).toBe('en');
});

// The French forms in a browser (#12 with #13): the token comes from the preview's always-pass
// Turnstile key, and the refusals read in French. Each test counts under a rate-limit key of its own.
const PASS = 'XXXX.DUMMY.TOKEN.XXXX';
const FAILED_FR = 'Nous n’avons pas pu confirmer que l’envoi vient d’une personne. Rechargez la page et réessayez.';
const ownLimit = (name: string) => `french-form-journey-${name}-${Date.now()}-${Math.random()}`;

/** Sends the preview's requests with the protection header, and `extra` headers on `api`. Returns what `api` was sent. */
async function authorise(page: Page, api: string, extra: Record<string, string>) {
  const origin = new URL(PREVIEW!).origin;
  const sent: Array<{ body: Record<string, unknown>; status: number; json: Record<string, unknown> }> = [];
  await page.route(
    (url) => url.origin === origin,
    async (route) => {
      const headers = { ...route.request().headers(), ...protection() };
      if (new URL(route.request().url()).pathname !== api) return route.continue({ headers });
      const response = await route.fetch({ headers: { ...headers, ...extra } });
      sent.push({ body: route.request().postDataJSON(), status: response.status(), json: await response.json().catch(() => ({})) });
      return route.fulfill({ response });
    },
  );
  return sent;
}

async function sendFrenchForm(page: Page, address: string) {
  await page.goto('/fr/download/');
  await page.getByLabel('Courriel', { exact: true }).fill(address);
  await page.getByRole('button', { name: 'Envoyer le lien de téléchargement' }).click();
}

test.describe('the French forms', () => {
  test('the French download form sends lang and the token, and gets the French email', async ({ page }) => {
    const address = `french-form-journey+ok-${Date.now()}@example.com`;
    emails.push(address);
    const sent = await authorise(page, '/api/signup', { 'x-capture-email': '1', 'x-rate-limit-key': ownLimit('ok') });
    await sendFrenchForm(page, address);
    await expect(page.getByRole('heading', { name: 'Vérifiez vos courriels' })).toBeVisible();
    expect(sent.map((s) => s.status)).toEqual([200]);
    expect(sent[0].body).toMatchObject({ email: address, lang: 'fr', turnstile: PASS });
    const captured = sent[0].json.captured as { subject: string; text: string };
    expect(captured.subject).toBe('Votre lien de téléchargement CacheDrop');
    expect(captured.text).toMatch(/https:\/\/\S+\/fr\/download\/[A-Za-z0-9_-]{43}\//);
  });

  test('the French download form says in French when the bot check is refused', async ({ page }) => {
    const address = `french-form-journey+refused-${Date.now()}@example.com`;
    emails.push(address);
    const sent = await authorise(page, '/api/signup', { 'x-capture-email': '1', 'x-rate-limit-key': ownLimit('refused'), 'x-turnstile-test': 'fail' });
    await sendFrenchForm(page, address);
    await expect(page.getByRole('alert')).toHaveText(FAILED_FR);
    expect(sent.map((s) => s.status)).toEqual([403]);
    if (dev) expect((await dev.from('signups').select('id').eq('email', address)).data).toEqual([]);
  });

  test('the French download form says in French how long to wait once the place is rate-limited', async ({ page, request }) => {
    const limit = ownLimit('limited');
    for (let i = 0; i < 5; i++) {
      const address = `french-form-journey+limit${i}-${Date.now()}@example.com`;
      emails.push(address);
      const res = await request.post('/api/signup', {
        headers: { ...protection(), 'x-capture-email': '1', 'x-rate-limit-key': limit },
        data: { email: address, lang: 'fr', turnstile: PASS },
      });
      expect(res.status()).toBe(200);
    }
    const address = `french-form-journey+limit-over-${Date.now()}@example.com`;
    emails.push(address);
    const sent = await authorise(page, '/api/signup', { 'x-capture-email': '1', 'x-rate-limit-key': limit });
    await sendFrenchForm(page, address);
    await expect(page.getByRole('alert')).toHaveText(/^Il y a eu beaucoup d’essais à partir de votre réseau\. Réessayez dans (une minute|\d+\u00a0minutes)\.$/);
    expect(sent.map((s) => s.status)).toEqual([429]);
  });

  test('the French feedback modal says in French when the bot check is refused', async ({ page }) => {
    const sent = await authorise(page, '/api/feedback', { 'x-rate-limit-key': ownLimit('feedback'), 'x-turnstile-test': 'fail' });
    await page.goto('/fr/');
    await page.locator('[data-feedback]').first().click();
    await page.getByLabel('Que devrions-nous changer?').fill('Parcours de test : refusé, rien n’est classé.');
    await page.getByRole('button', { name: 'Envoyer mon avis' }).click();
    await expect(page.getByRole('alert')).toHaveText(FAILED_FR);
    expect(sent.map((s) => s.status)).toEqual([403]);
    expect(sent[0].body.turnstile).toBe(PASS);
  });
});
