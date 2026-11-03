import { test, expect, type Page } from '@playwright/test';
import { pages, ui } from './pages';

// Decision 44: the build with the launch setting on (PUBLIC_PRICING_LIVE=1), served by the
// `pricing-live` project in playwright.config.ts.
const live = [...pages, { path: '/pricing/' }, { path: '/fr/pricing/', lang: 'fr' as const }];
const langOf = (p: { lang?: 'fr' }) => p.lang ?? 'en';

const copy = {
  en: {
    pricing: ['Pricing', '/pricing/'],
    download: 'Download Free',
    title: 'Try it free. Pay once.',
    spoken: 'Was $29.99, now $19.99 for a limited time, one-time.',
    shown: ['$29.99', '$19.99', 'one-time'],
    currencies: 'Pay in USD, CAD, EUR, GBP or AUD: the same number in each.',
    items: ['Free cleanup up to 2 GB, and scanning is always free', 'Use it on up to 3 of your Macs', 'Every 1.x release', '30-day refunds, no questions asked'],
    buy: ['Buy a License', '/buy'],
    legal: [['terms of sale', '/terms-of-sale/'], ['refund policy', '/refund-policy/'], ['license agreement', '/license-agreement/']],
    tried: ['Already tried it?', 'Buy a license'],
    news: 'Email me news about CacheDrop, like new features and surveys.',
  },
  fr: {
    pricing: ['Tarifs', '/fr/pricing/'],
    download: 'Télécharger gratuitement',
    title: 'Essayez-le gratuitement. Payez une seule fois.',
    spoken: 'Prix régulier 29,99 $, maintenant 19,99 $, une seule fois.',
    shown: ['29,99 $', '19,99 $', 'une seule fois'],
    currencies: 'Payez en USD, CAD, EUR, GBP ou AUD : le même montant dans chaque devise.',
    items: ['Nettoyage gratuit jusqu’à 2 Go, et l’analyse est toujours gratuite', 'Sur un maximum de 3 de vos Mac', 'Toutes les versions 1.x', 'Remboursement dans les 30 jours, sans avoir à vous justifier'],
    news: 'Envoyez-moi des nouvelles de CacheDrop par courriel : nouvelles fonctionnalités et sondages.',
    buy: ['Acheter une licence', '/buy?lang=fr'],
    legal: [['conditions de vente', '/fr/terms-of-sale/'], ['politique de remboursement', '/fr/refund-policy/'], ['contrat de licence', '/fr/license-agreement/']],
    tried: ['Vous l’avez déjà essayé?', 'Achetez une licence'],
  },
} as const;

async function expectPricing(page: Page, lang: 'en' | 'fr', level: 1 | 2) {
  const c = copy[lang];
  const section = page.getByRole('region', { name: c.title });
  await expect(section.getByRole('heading', { level, name: c.title })).toBeVisible();
  const price = section.locator('[data-price]');
  // Screen readers get the sentence; the struck-through and current prices are hidden from them.
  await expect(price.locator('.sr-only')).toHaveText(c.spoken);
  await expect(price.locator('s')).toHaveText(c.shown[0]);
  await expect(price.locator('s')).toHaveAttribute('aria-hidden', 'true');
  await expect(price.locator('s')).toHaveCSS('text-decoration-line', 'line-through');
  for (const text of c.shown) await expect(price.getByText(text, { exact: true })).toBeVisible();
  await expect(section.getByText(c.currencies)).toBeVisible();
  await expect(section.getByRole('listitem')).toHaveText([...c.items]);
  await expect(section.getByRole('link', { name: c.buy[0] })).toHaveAttribute('href', c.buy[1]);
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

test('the sitemap lists /pricing/ and /fr/pricing/', async ({ request }) => {
  const xml = await (await request.get('/sitemap.xml')).text();
  for (const loc of ['https://cachedrop.io/pricing/', 'https://cachedrop.io/fr/pricing/']) expect(xml).toContain(`<loc>${loc}</loc>`);
});

for (const p of live) {
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
for (const p of live.filter((p) => !/^(\/fr)?\/download\//.test(p.path))) {
  test(`${p.path}: every Download link goes to the email form`, async ({ page }) => {
    await page.goto(p.path);
    const hrefs = await page.locator('a', { hasText: /download|get your space back|télécharg|obtenir/i }).evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) expect(href).toBe(ui[langOf(p)].download);
  });
}
