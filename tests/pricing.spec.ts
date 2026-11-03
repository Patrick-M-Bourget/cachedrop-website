import { test, expect, type Page } from '@playwright/test';
import { pages, ui } from './pages';
import { compareLive } from '../src/components/pricing';

// Pricing (Decisions 44 and 47) on every build: the launch setting retired with Decision 52.
const withPricing = [...pages, { path: '/pricing/' }, { path: '/fr/pricing/', lang: 'fr' as const }];
const langOf = (p: { lang?: 'fr' }) => p.lang ?? 'en';

const copy = {
  en: {
    pricing: ['Pricing', '/pricing/'],
    download: 'Download for Mac',
    title: 'Pay once. Use it on 3 Macs.',
    body: 'See what’s filling your Mac, clean it up safely, and remove apps and plug-ins completely.',
    spoken: 'Was $29.99, now $19.99 for a limited time, one-time.',
    shown: ['$29.99', '$19.99', 'one-time'],
    currencies: 'Pay in USD, CAD, EUR, GBP or AUD: the same number in each.',
    // #113: the owner's wording for 3 Macs, version 1 updates, nothing to cancel and refunds.
    items: [
      'Use it on up to 3 of your Macs.',
      'Every update through version 1, ready for each new macOS when it ships.',
      'No subscription. Nothing to cancel.',
      '30-day refunds, no questions asked.',
      'Scanning is always free, and you can clean up to 2 GB before you buy.',
    ],
    compare: 'Compare CacheDrop with other Mac cleaners',
    // Decision 51: "Buy · $29.99 once", the regular price struck through before the offer.
    buy: ['Buy · was $29.99 now $19.99 once', '/buy'],
    legal: [['terms of sale', '/terms-of-sale/'], ['refund policy', '/refund-policy/'], ['license agreement', '/license-agreement/']],
    tried: ['Already tried it?', 'Buy a license'],
    news: 'Email me news about CacheDrop, like new features and surveys.',
  },
  fr: {
    pricing: ['Tarifs', '/fr/pricing/'],
    download: 'Télécharger pour Mac',
    title: 'Payez une seule fois. Utilisez-le sur 3 Mac.',
    body: 'Voyez ce qui remplit votre Mac, nettoyez-le en toute sécurité et désinstallez complètement applications et plug-ins.',
    spoken: 'Prix régulier 29,99 $, maintenant 19,99 $ pour un temps limité, une seule fois.',
    shown: ['29,99 $', '19,99 $', 'une seule fois'],
    currencies: 'Payez en USD, CAD, EUR, GBP ou AUD : le même montant dans chaque devise.',
    items: [
      'Utilisez-le sur un maximum de 3 de vos Mac.',
      'Toutes les mises à jour de la version 1, prêtes pour chaque nouvelle version de macOS dès sa sortie.',
      'Aucun abonnement. Rien à annuler.',
      'Remboursement dans les 30 jours, sans avoir à vous justifier.',
      'L’analyse est toujours gratuite, et vous pouvez nettoyer jusqu’à 2 Go avant d’acheter.',
    ],
    compare: 'Comparer CacheDrop aux autres nettoyeurs pour Mac',
    news: 'Envoyez-moi des nouvelles de CacheDrop par courriel : nouvelles fonctionnalités et sondages.',
    buy: ['Acheter · prix régulier 29,99\u00a0$ maintenant 19,99\u00a0$', '/buy?lang=fr'],
    legal: [['conditions de vente', '/fr/terms-of-sale/'], ['politique de remboursement', '/fr/refund-policy/'], ['contrat de licence', '/fr/license-agreement/']],
    tried: ['Vous l’avez déjà essayé?', 'Achetez une licence'],
  },
} as const;

async function expectPricing(page: Page, lang: 'en' | 'fr', level: 1 | 2) {
  const c = copy[lang];
  const section = page.getByRole('region', { name: c.title });
  await expect(section.getByRole('heading', { level, name: c.title })).toBeVisible();
  // What CacheDrop does comes before the price in reading order (#113).
  const body = section.getByText(c.body);
  await expect(body).toBeVisible();
  const priceHandle = await section.locator('[data-price]').elementHandle();
  expect(await body.evaluate((b, p) => !!(b.compareDocumentPosition(p!) & Node.DOCUMENT_POSITION_FOLLOWING), priceHandle)).toBe(true);
  const price = section.locator('[data-price]');
  // Screen readers get the sentence; the struck-through and current prices are hidden from them.
  await expect(price.locator('.sr-only')).toHaveText(c.spoken);
  await expect(price.locator('s')).toHaveText(c.shown[0]);
  await expect(price.locator('s')).toHaveAttribute('aria-hidden', 'true');
  await expect(price.locator('s')).toHaveCSS('text-decoration-line', 'line-through');
  for (const text of c.shown) await expect(price.getByText(text, { exact: true })).toBeVisible();
  await expect(section.getByText(c.currencies)).toBeVisible();
  await expect(section.getByRole('listitem')).toHaveText([...c.items]);
  const buy = section.getByRole('link', { name: c.buy[0], exact: true });
  await expect(buy).toHaveAttribute('href', c.buy[1]);
  await expect(buy).toHaveText(c.buy[0]);
  // The words "was" and "now" are for screen readers only.
  await expect(buy.locator('.sr-only')).toHaveCount(2);
  await expect(buy.locator('s')).toHaveText(c.shown[0]);
  await expect(section.getByRole('link', { name: c.download })).toHaveAttribute('href', ui[lang].download);
  for (const [name, href] of c.legal) await expect(section.getByRole('link', { name, exact: true })).toHaveAttribute('href', href);
}

for (const lang of ['en', 'fr'] as const) {
  test(`${lang}: the homepage has the pricing section, between "Careful by default" and the FAQ`, async ({ page }) => {
    await page.goto(ui[lang].home);
    await expectPricing(page, lang, 2);
    const order = await page.locator('section').evaluateAll((s) => s.map((e) => e.id));
    expect(order.indexOf('pricing')).toBe(order.indexOf('faq') - 1);
  });

  test(`${lang}: /pricing/ is the pricing section as a page, indexed with its alternates`, async ({ page }) => {
    const path = copy[lang].pricing[1];
    await page.goto(path);
    await expectPricing(page, lang, 1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://cachedrop.io${path}`);
    await expect(page.locator('link[rel="alternate"][hreflang="fr"]')).toHaveAttribute('href', 'https://cachedrop.io/fr/pricing/');
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
    await expect(page.getByRole('banner').getByRole('link', { name: copy[lang].pricing[0] })).toHaveAttribute('aria-current', 'page');
  });

  test(`${lang}: the news box no longer mentions the paid launch`, async ({ page }) => {
    await page.goto(lang === 'en' ? '/download/' : '/fr/download/');
    await expect(page.getByRole('checkbox', { name: copy[lang].news, exact: true })).toBeVisible();
  });

  test(`${lang}: the download page offers "Already tried it? Buy a license", also once the link is sent`, async ({ page }) => {
    const [tried, buy] = copy[lang].tried;
    await page.route('**/api/signup', (route) => route.fulfill({ json: { ok: true } }));
    await page.goto(ui[lang].download);
    const line = page.locator('[data-buy]');
    await expect(line).toHaveText(`${tried} ${buy}`);
    await expect(line.getByRole('link', { name: buy })).toHaveAttribute('href', copy[lang].buy[1]);
    await page.locator('#gate-email').fill('ada@example.com');
    await page.locator('[data-gate-form] [type=submit]').click();
    await expect(page.locator('[data-gate-done]')).toBeVisible();
    await expect(line).toBeVisible();
  });

  test(`${lang}: the homepage offer carries the price`, async ({ page }) => {
    await page.goto(ui[lang].home);
    const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
    // Decision 47: what a buyer pays today, with the regular price struck through.
    expect(ld['@graph'][1].offers).toEqual({
      '@type': 'Offer',
      price: '19.99',
      priceCurrency: 'USD',
      priceSpecification: { '@type': 'UnitPriceSpecification', priceType: 'https://schema.org/StrikethroughPrice', price: '29.99', priceCurrency: 'USD' },
    });
  });
}

test('the price answers state the regular price and the discount (Decision 47)', async ({ page }) => {
  await page.goto('/pricing/');
  expect(await page.title()).toContain('$29.99');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /\$29\.99 once, now \$19\.99 for a limited time/);
  await page.goto('/');
  await expect(page.getByText('A license is $29.99 once, now $19.99 for a limited time, for up to 3 Macs.')).toBeVisible();
  await page.goto('/fr/');
  await expect(page.getByText('La licence coûte 29,99\u00a0$ une seule fois, maintenant 19,99\u00a0$ pour un temps limité, pour un maximum de 3 Mac.')).toBeVisible();
});

test('the /pricing/ title and meta lead with what CacheDrop does, then the price and terms (#113)', async ({ page }) => {
  await page.goto('/pricing/');
  expect(await page.title()).toBe('CacheDrop Pricing – $29.99 Once for Up to 3 Macs');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    'CacheDrop finds what’s filling your Mac and clears it safely. A license is $29.99 once, now $19.99 for a limited time, for up to 3 Macs, with every update through version 1 and 30-day refunds. Nothing to cancel.',
  );
  await page.goto('/fr/pricing/');
  expect(await page.title()).toBe('Tarifs de CacheDrop – 29,99 $ une seule fois, jusqu’à 3 Mac');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    'CacheDrop trouve ce qui remplit votre Mac et le nettoie en toute sécurité. La licence coûte 29,99 $ une seule fois, maintenant 19,99 $ pour un temps limité, pour un maximum de 3 Mac, avec toutes les mises à jour de la version 1 et le remboursement dans les 30 jours. Rien à annuler.',
  );
});

// #113: the card links to the compare page (#87) only while that page is built and indexed in the
// page's language, so the link never leads to a 404 or a draft. Turning `compareLive` on is the
// compare page's job; this fails if the switch and the build disagree either way.
for (const lang of ['en', 'fr'] as const) {
  test(`${lang}: the pricing card links to the compare page exactly when it is live`, async ({ page, request }) => {
    const target = lang === 'en' ? '/compare/' : '/fr/compare/';
    const res = await request.get(target);
    const live = res.status() === 200 && !/<meta name="robots"[^>]*noindex/.test(await res.text());
    expect(compareLive[lang], `compareLive.${lang} must match whether ${target} is live`).toBe(live);
    for (const path of [copy[lang].pricing[1], ui[lang].home]) {
      await page.goto(path);
      const link = page.locator('#pricing [data-compare]');
      await expect(link).toHaveCount(live ? 1 : 0);
      if (live) {
        await expect(link).toHaveAttribute('href', target);
        await expect(link).toHaveText(copy[lang].compare);
      }
    }
  });
}

test('the sitemap lists /pricing/ and /fr/pricing/', async ({ request }) => {
  const xml = await (await request.get('/sitemap.xml')).text();
  for (const loc of ['https://cachedrop.io/pricing/', 'https://cachedrop.io/fr/pricing/']) expect(xml).toContain(`<loc>${loc}</loc>`);
});

for (const p of withPricing) {
  const lang = langOf(p);
  const c = copy[lang];
  test(`${p.path}: nav has no BETA badge, a Pricing link and "${c.download}"; no beta copy anywhere`, async ({ page }) => {
    await page.goto(p.path);
    const nav = page.getByRole('banner');
    await expect(nav.getByText(/^(BETA|BÊTA)$/)).toHaveCount(0);
    const primary = nav.getByRole('navigation');
    const links = await primary.getByRole('link').allTextContents();
    expect(links.slice(0, 4)).toEqual(lang === 'en' ? ['For Developers', 'For Creators', 'For Music Producers', 'Pricing'] : ['Pour les développeurs', 'Pour les créateurs', 'Pour les producteurs de musique', 'Tarifs']);
    await expect(primary.getByRole('link', { name: c.pricing[0], exact: true })).toHaveAttribute('href', c.pricing[1]);
    await expect(nav.getByRole('link', { name: c.download, exact: true })).toHaveAttribute('href', ui[lang].download);
    await expect(nav.locator('a[href^="/buy"]')).toHaveCount(0);
    await expect(page.getByRole('contentinfo').getByRole('link', { name: c.download, exact: true })).toHaveAttribute('href', ui[lang].download);
    // "Get Free Beta", "Free while in beta", "Public beta" and the rest are gone, from the text and the head.
    expect(await page.locator('body').innerText()).not.toMatch(/beta|bêta/i);
    expect(await page.locator('head').innerHTML()).not.toMatch(/beta|bêta/i);
  });
}

for (const path of ['/clear-mac-developer-caches/', '/clear-adobe-media-cache-mac/', '/fr/clear-mac-developer-caches/', '/fr/clear-adobe-media-cache-mac/']) {
  test(`${path}: no Buy link on the guide`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('a[href^="/buy"]')).toHaveCount(0);
    await expect(page.getByText(path.startsWith('/fr/') ? /Essai gratuit\.$/ : /Free to try\.$/)).toBeVisible();
  });
}

// The email gate stays required (#60, mac-cleaner #581): every download link still goes to the form.
for (const p of withPricing.filter((p) => !/^(\/fr)?\/download\//.test(p.path))) {
  test(`${p.path}: every Download link goes to the email form`, async ({ page }) => {
    await page.goto(p.path);
    const hrefs = await page.locator('a', { hasText: /download|télécharg|try cachedrop|essayer cachedrop/i }).evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) expect(href).toBe(ui[langOf(p)].download);
  });
}
