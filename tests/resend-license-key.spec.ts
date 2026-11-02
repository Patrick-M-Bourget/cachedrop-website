import { test, expect, type Page } from '@playwright/test';

// The "Resend my license key" page (Decision 42) against the static build, with the license
// function's resend route (Decision 40) mocked. Local builds and CI post to the same-origin
// fallback path (src/components/license-resend.ts); the glob also matches a Supabase host.
const API = '**/functions/v1/license/resend';
// The token Cloudflare's always-pass test site key gives (Decision 12).
const turnstile = 'XXXX.DUMMY.TOKEN.XXXX';

/** Records what the form posts and answers with `status` and `body`. */
async function mockResend(page: Page, status = 200, body: object = { ok: true }, headers: Record<string, string> = {}) {
  const sent: unknown[] = [];
  await page.route(API, async (route) => {
    sent.push(route.request().postDataJSON());
    await route.fulfill({ status, json: body, headers });
  });
  return sent;
}

const copy = {
  en: {
    path: '/resend-license-key/',
    title: 'Get your license key again.',
    email: 'Email',
    send: 'Resend License Key',
    done: 'Check your inbox',
    sent: 'If that address bought a license, its key is on its way.',
    badEmail: 'Enter a full email address, like you@example.com.',
    botCheck: 'We couldn’t confirm this came from a person. Reload the page and try again.',
    limited: 'That’s a lot of tries from your network. Try again in 20 minutes.',
    unavailable: 'We couldn’t send the key right now. Try again in a few minutes.',
    offline: 'We couldn’t send the key. Check your connection and try again.',
    privacy: ['Privacy Policy', '/privacy/'],
    again: 'Use a Different Email',
  },
  fr: {
    path: '/fr/resend-license-key/',
    title: 'Recevez de nouveau votre clé de licence.',
    email: 'Courriel',
    send: 'Renvoyer la clé de licence',
    done: 'Vérifiez vos courriels',
    sent: 'Si une licence a été achetée avec cette adresse, sa clé est en route.',
    badEmail: 'Entrez une adresse courriel complète, comme vous@exemple.com.',
    botCheck: 'Nous n’avons pas pu confirmer que l’envoi vient d’une personne. Rechargez la page et réessayez.',
    limited: 'Il y a eu beaucoup d’essais à partir de votre réseau. Réessayez dans 20 minutes.',
    unavailable: 'La clé n’a pas pu être envoyée pour le moment. Réessayez dans quelques minutes.',
    offline: 'La clé n’a pas pu être envoyée. Vérifiez votre connexion et réessayez.',
    privacy: ['Politique de confidentialité', '/fr/privacy/'],
    again: 'Utiliser une autre adresse',
  },
} as const;

for (const lang of ['en', 'fr'] as const) {
  const t = copy[lang];
  const send = async (page: Page, address: string) => {
    await page.getByLabel(t.email, { exact: true }).fill(address);
    await page.getByRole('button', { name: t.send }).click();
  };

  test.describe(`the resend form (${lang})`, () => {
    test('sends the email, language and bot-check token, then gives the same answer for any address', async ({ page }) => {
      const sent = await mockResend(page);
      await page.goto(t.path);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(t.title);
      await send(page, ' ada@example.com ');
      await expect(page.getByRole('heading', { name: t.done })).toBeFocused();
      await expect(page.getByText(t.sent)).toBeVisible();
      await expect(page.getByLabel(t.email, { exact: true })).toBeHidden();
      expect(sent).toEqual([{ email: 'ada@example.com', lang, turnstile }]);
      await page.getByRole('button', { name: t.again }).click();
      await expect(page.getByLabel(t.email, { exact: true })).toBeFocused();
      await expect(page.getByLabel(t.email, { exact: true })).toHaveValue('');
    });

    test('explains an incomplete email without sending anything', async ({ page }) => {
      const sent = await mockResend(page);
      await page.goto(t.path);
      await send(page, 'ada@');
      await expect(page.getByRole('alert')).toHaveText(t.badEmail);
      await expect(page.getByLabel(t.email, { exact: true })).toHaveAttribute('aria-invalid', 'true');
      expect(sent).toEqual([]);
    });

    test('marks the field when the function refuses the address', async ({ page }) => {
      await mockResend(page, 400, { error: 'invalid_email' });
      await page.goto(t.path);
      await send(page, 'ada@example.com');
      await expect(page.getByRole('alert')).toHaveText(t.badEmail);
      await expect(page.getByLabel(t.email, { exact: true })).toHaveAttribute('aria-invalid', 'true');
    });

    test('says so calmly when the function refuses the bot check, and can send again', async ({ page }) => {
      const sent = await mockResend(page, 403, { error: 'bot_check' });
      await page.goto(t.path);
      await send(page, 'ada@example.com');
      await expect(page.getByRole('alert')).toHaveText(t.botCheck);
      await expect(page.getByLabel(t.email, { exact: true })).not.toHaveAttribute('aria-invalid');
      await page.getByRole('button', { name: t.send }).click();
      await expect.poll(() => sent.length).toBe(2);
    });

    test('says how long to wait when rate-limited', async ({ page }) => {
      await mockResend(page, 429, { error: 'rate_limited', retryAfter: 1150 }, { 'retry-after': '1150' });
      await page.goto(t.path);
      await send(page, 'ada@example.com');
      await expect(page.getByRole('alert')).toHaveText(t.limited);
    });

    for (const [status, error] of [[503, 'unavailable'], [502, 'email_failed']] as const) {
      test(`says to try again later when the function answers ${status}`, async ({ page }) => {
        await mockResend(page, status, { error });
        await page.goto(t.path);
        await send(page, 'ada@example.com');
        await expect(page.getByRole('alert')).toHaveText(t.unavailable);
        await expect(page.getByRole('button', { name: t.send })).toBeEnabled();
      });
    }

    test('says to check the connection when the request never arrives', async ({ page }) => {
      await page.route(API, (route) => route.abort('internetdisconnected'));
      await page.goto(t.path);
      await send(page, 'ada@example.com');
      await expect(page.getByRole('alert')).toHaveText(t.offline);
    });

    test('links to the privacy policy and is kept out of search results', async ({ page }) => {
      await page.goto(t.path);
      await expect(page.locator('form').getByRole('link', { name: t.privacy[0] })).toHaveAttribute('href', t.privacy[1]);
      await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', 'noindex, follow');
    });
  });
}
