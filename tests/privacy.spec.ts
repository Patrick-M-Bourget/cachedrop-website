import { test, expect, type Page } from '@playwright/test';

// Decision 19 (with 16 and 29): what the privacy policy must say. Each test reads the
// rendered page, the way a visitor would.

async function sectionText(page: Page, heading: string) {
  const section = page.locator('section', { has: page.getByRole('heading', { level: 2, name: heading }) });
  await expect(section).toHaveCount(1);
  return (await section.innerText()).replace(/\s+/g, ' ');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/privacy/');
});

test('names the person in charge and the privacy contact', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Privacy policy');
  const text = await sectionText(page, 'Who is responsible');
  expect(text).toContain('person in charge of the protection of personal information');
  expect(text).toContain('owner');
  await expect(page.getByRole('link', { name: 'privacy@cachedrop.io' }).first()).toHaveAttribute('href', 'mailto:privacy@cachedrop.io');
});

test('lists what is collected and why', async ({ page }) => {
  const text = await sectionText(page, 'What we collect and why');
  for (const item of [
    'Your email address',
    'What’s filling your Mac',
    'News emails',
    'Feedback',
    'System specs',
    'Page visits',
    'Download counts',
  ]) {
    expect(text, item).toContain(item);
  }
  expect(text).toContain('without cookies'); // Decision 16
});

test('says what Vercel Web Analytics records about a visit (Decision 16)', async ({ page }) => {
  const visits = (await page.locator('#collect li', { hasText: 'Page visits' }).innerText()).replace(/\s+/g, ' ');
  expect(visits).toContain('Vercel Web Analytics');
  for (const field of ['page you visit', 'site that sent you', 'country', 'browser', 'operating system', 'type of device']) {
    expect(visits, field).toContain(field);
  }
  expect(visits).toContain('without cookies');
  expect(visits).toContain('We remove the code from download links');
});

test('lists every provider and says which are outside Quebec', async ({ page }) => {
  const text = await sectionText(page, 'Who handles your information');
  for (const provider of ['Supabase', 'Vercel', 'Resend', 'Cloudflare', 'GitHub']) expect(text, provider).toContain(provider);
  // Decision 31 (amends 13): Supabase is in AWS US regions, so it is listed as outside Quebec.
  const supabase = (await page.locator('#providers li', { hasText: 'Supabase' }).innerText()).replace(/\s+/g, ' ');
  expect(supabase).toContain('Outside Quebec');
  expect(supabase).toContain('United States');
  expect(text).not.toContain('Montreal');
  expect(text).not.toMatch(/\bin Quebec\b/);
  expect(text).toContain('outside Quebec');
  expect(text).toContain('forwards email'); // Decision 29: Cloudflare Email Routing
  // Decision 30: the policy describes the launch state, where feedback issues are private.
  expect(text).toContain('private GitHub repository');
  expect(text).not.toMatch(/\bpublic\b/i);
});

test('states how long each kind of data is kept', async ({ page }) => {
  const text = await sectionText(page, 'How long we keep it');
  // Decision 32: an unsubscribe leaves a do-not-email marker; only a deletion request removes it.
  expect(text).toContain('until you ask us to delete them');
  expect(text).not.toContain('until you unsubscribe');
  expect(text).toContain('If you unsubscribe, we keep only your email address, marked so we never email you again.');
  expect(text).toContain('Write to privacy@cachedrop.io and we delete it completely.');
  expect(text).toContain('30 days after');
  expect(text).toContain('with the feedback');
});

test('explains your rights, including a complaint to the CAI', async ({ page }) => {
  const text = await sectionText(page, 'Your rights');
  for (const right of ['see', 'correct', 'withdraw your consent', 'delete', 'Commission d’accès à l’information']) {
    expect(text, right).toContain(right);
  }
});

test('has no mailing address or placeholder for one (Decision 33)', async ({ page }) => {
  await expect(page.locator('[data-placeholder="mailing-address"]')).toHaveCount(0);
  const text = await sectionText(page, 'Contact us');
  expect(text).not.toMatch(/placeholder|mailing address|postal box/i);
});

test('says what the spam check uses, and that the IP address is never stored (Decision 12)', async ({ page }) => {
  const spam = (await page.locator('#collect li', { hasText: 'Spam protection' }).innerText()).replace(/\s+/g, ' ');
  for (const part of ['Cloudflare Turnstile', 'IP address', 'information about your browser', 'only when you use a form', 'limit how many forms']) {
    expect(spam, part).toContain(part);
  }
  const cloudflare = (await page.locator('#providers li', { hasText: 'Cloudflare' }).innerText()).replace(/\s+/g, ' ');
  expect(cloudflare).toContain('Turnstile');
  expect(cloudflare).toContain('IP address');
  const kept = (await page.locator('#retention li', { hasText: 'IP addresses' }).innerText()).replace(/\s+/g, ' ');
  expect(kept).toContain('we never store your IP address');
  expect(kept).toContain('at most a day');
});

// Review fixes: the download link is a bearer link, and every stored item has a stated retention.
const policy = {
  en: {
    path: '/privacy/',
    collect: 'What we collect and why',
    retention: 'How long we keep it',
    token: ['Anyone with the link can use it for 7 days, so don’t share it.'],
    collected: ['Your language', 'A code in each email’s unsubscribe link'],
    kept: [
      'Feedback: your rating, your message, the page, your email if you added one, and the system specs if you sent them. We keep it until you ask us to delete it.',
      'your news choice and your language',
      'Unsubscribe codes: we keep them as long as your signup, and delete them with it.',
    ],
  },
  fr: {
    path: '/fr/privacy/',
    collect: 'Ce que nous recueillons et pourquoi',
    retention: 'Combien de temps nous les gardons',
    token: ['Toute personne qui a le lien peut s’en servir pendant 7 jours. Ne le partagez donc pas.'],
    collected: ['Votre langue', 'Un code dans le lien de désabonnement de chaque courriel'],
    kept: [
      'Les avis : votre note, votre message, la page, votre adresse courriel si vous l’avez ajoutée, et les caractéristiques du système si vous les avez envoyées. Nous les gardons jusqu’à ce que vous nous demandiez de les supprimer.',
      'votre choix pour les courriels de nouvelles et votre langue',
      'Les codes de désabonnement : nous les gardons aussi longtemps que votre inscription, et les supprimons avec elle.',
    ],
  },
};

for (const [lang, p] of Object.entries(policy)) {
  test.describe(`${lang}: ${p.path}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(p.path);
    });

    test('says anyone with the download link can use it, so not to share it', async ({ page }) => {
      const text = await sectionText(page, p.collect);
      for (const line of p.token) expect(text).toContain(line);
      expect(text).not.toMatch(/only for you|ne fonctionne que pour vous/);
    });

    test('lists the stored language and the unsubscribe codes', async ({ page }) => {
      const text = await sectionText(page, p.collect);
      for (const item of p.collected) expect(text, item).toContain(item);
    });

    test('states how long feedback, the language and unsubscribe codes are kept', async ({ page }) => {
      const text = await sectionText(page, p.retention);
      for (const line of p.kept) expect(text, line).toContain(line);
    });
  });
}
