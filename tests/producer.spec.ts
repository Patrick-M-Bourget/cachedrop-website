import { test, expect, type Page } from '@playwright/test';

// The producer page (#52, Decision 48): a guide with the signup form in its hero, "Music & audio"
// pre-selected, a HowTo in its JSON-LD and a nav link. The signup endpoint is mocked as in download.spec.ts.

const turnstile = 'XXXX.DUMMY.TOKEN.XXXX';

async function mockSignup(page: Page) {
  const requests: unknown[] = [];
  await page.route('**/api/signup', async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, json: { ok: true } });
  });
  return requests;
}

async function jsonLd(page: Page) {
  const raw = await page.locator('script[type="application/ld+json"]').first().textContent();
  return JSON.parse(raw!)['@graph'] as Array<Record<string, unknown>>;
}

const langs = [
  { path: '/uninstall-audio-plugins-mac/', lang: 'en', music: 'Music & audio', email: 'Email', send: 'Send Download Link', done: 'Check your inbox', nav: 'For Producers' },
  { path: '/fr/uninstall-audio-plugins-mac/', lang: 'fr', music: 'Musique et audio', email: 'Courriel', send: 'Envoyer le lien de téléchargement', done: 'Vérifiez vos courriels', nav: 'Pour les producteurs' },
] as const;

for (const l of langs) {
  test.describe(l.path, () => {
    test('signs up on the page with Music & audio pre-selected and the news box unticked', async ({ page }) => {
      const requests = await mockSignup(page);
      await page.goto(l.path);
      await expect(page.getByLabel(l.music)).toBeChecked();
      await expect(page.getByRole('radio', { checked: true })).toHaveCount(1);
      await expect(page.getByRole('checkbox')).not.toBeChecked();
      await page.getByLabel(l.email, { exact: true }).fill('ada@example.com');
      await page.getByRole('button', { name: l.send }).click();
      await expect(page.getByRole('heading', { name: l.done })).toBeFocused();
      expect(requests).toEqual([{ email: 'ada@example.com', filling: 'music-audio', news: false, lang: l.lang, turnstile }]);
    });

    test('marks its nav link as the current page', async ({ page }) => {
      await page.goto(l.path);
      await expect(page.getByRole('link', { name: l.nav })).toHaveAttribute('aria-current', 'page');
    });

    test('describes the manual uninstall as a HowTo and keeps the FAQ in step', async ({ page }) => {
      await page.goto(l.path);
      const graph = await jsonLd(page);
      const howTo = graph.find((n) => n['@type'] === 'HowTo') as { step: Array<{ text: string }> };
      const steps = await page.locator('#uninstall ol').first().locator('li').allTextContents();
      expect(howTo.step.map((s) => s.text)).toEqual(steps);
      const faq = graph.find((n) => n['@type'] === 'FAQPage') as { mainEntity: Array<{ name: string }> };
      expect(faq.mainEntity.map((q) => q.name)).toEqual(await page.locator('#faq h3').allTextContents());
    });
  });
}

// Decision 48: the copy never claims what the app doesn't do.
test('makes no claim the app contradicts', async ({ page }) => {
  for (const l of langs) {
    await page.goto(l.path);
    const text = (await page.locator('main').innerText()).toLowerCase();
    for (const banned of ['unused plug-ins', 'duplicate plug-ins', 'every format at once', 'uninstall for free', 'plug-ins inutilisés'])
      expect(text, `${l.path} says "${banned}"`).not.toContain(banned);
  }
});
