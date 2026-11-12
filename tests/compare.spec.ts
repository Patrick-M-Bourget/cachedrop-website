import { test, expect } from '@playwright/test';
import { productName, rows } from '../src/components/compare';
import { compareLive, discounted, pricingCopy } from '../src/components/pricing';

// Decision 54: the CleanMyMac alternative page, in English and French.
const pages = {
  en: {
    path: '/cleanmymac-alternative/',
    title: 'CleanMyMac alternative you pay for once | CacheDrop',
    h1: 'A CleanMyMac alternative you pay for once.',
    lede: 'Looking for a CleanMyMac alternative without a subscription?',
    trademark: 'Product names are trademarks of their owners. CacheDrop isn’t affiliated with any of them.',
    footer: 'Compare to CleanMyMac',
    faq: ['Is CacheDrop a good CleanMyMac alternative?', 'Is CacheDrop a subscription?', 'Can I try it before I buy?', 'Do I need a RAM cleaner or antivirus on a Mac?', 'What happens to my files?'],
  },
  fr: {
    path: '/fr/cleanmymac-alternative/',
    title: 'Alternative à CleanMyMac payée une seule fois | CacheDrop',
    h1: 'Une alternative à CleanMyMac que vous payez une seule fois.',
    lede: 'Vous cherchez une alternative à CleanMyMac sans abonnement?',
    trademark: 'Les noms de produits sont des marques de commerce de leurs propriétaires. CacheDrop n’est affilié à aucun d’eux.',
    footer: 'Comparer à CleanMyMac',
    faq: ['CacheDrop est-il une bonne alternative à CleanMyMac?', 'CacheDrop est-il un abonnement?', 'Puis-je l’essayer avant d’acheter?', 'Ai-je besoin d’un nettoyeur de mémoire ou d’un antivirus sur Mac?', 'Qu’arrive-t-il à mes fichiers?'],
  },
} as const;

const competitors = rows.filter((r) => !r.us).map((r) => r.product);

test('the compare page is live in every language, so the pricing section links to it', () => {
  expect(compareLive).toEqual({ en: true, fr: true, de: true });
});

for (const [lang, c] of Object.entries(pages) as [keyof typeof pages, (typeof pages)[keyof typeof pages]][]) {
  const p = pricingCopy[lang];

  test(`${c.path}: title, H1, hero buttons and trial line`, async ({ page }) => {
    await page.goto(c.path);
    expect(await page.title()).toBe(c.title);
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
    await expect(page.locator('h1')).toHaveText(c.h1);
    await expect(page.locator('main h2').first()).toContainText(c.lede);
    const hero = page.locator('main section').first();
    await expect(hero.locator('.btn-primary')).toHaveText(p.download);
    await expect(hero.locator('.btn-primary')).toHaveAttribute('href', lang === 'fr' ? '/fr/download/' : '/download/');
    await expect(hero.locator('.btn-ghost')).toContainText(p.buy);
    await expect(hero).toContainText(p.trial);
    await expect(hero.locator('img, picture, video')).toHaveCount(0);
  });

  test(`${c.path}: the table lists every row, CacheDrop first at the regular price`, async ({ page }) => {
    await page.goto(c.path);
    const body = page.locator('[data-compare-table] tbody tr');
    await expect(body).toHaveCount(rows.length);
    expect(await body.locator('th').allTextContents()).toEqual(rows.map((r) => productName(lang, r)));
    const us = body.first();
    await expect(us.locator('[data-col="price"]')).toContainText(p.was);
    await expect(us).not.toContainText(p.now);
    await expect(page.locator('[data-offer]')).toHaveCount(discounted ? 1 : 0);
    if (discounted) await expect(page.locator('[data-offer]')).toContainText(p.now);
  });

  test(`${c.path}: "bloat" never shares a sentence with a competitor's name`, async ({ page }) => {
    await page.goto(c.path);
    const text = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
    const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => /bloat/i.test(s));
    for (const s of sentences) for (const name of competitors) expect(s, s).not.toContain(name);
  });

  test(`${c.path}: FAQ with FAQPage structured data, trademark line and footer link`, async ({ page }) => {
    await page.goto(c.path);
    expect(await page.locator('#faq h3').allTextContents()).toEqual([...c.faq]);
    const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
    const faq = ld['@graph'].find((n: { '@type': string }) => n['@type'] === 'FAQPage');
    expect(faq.mainEntity.map((q: { name: string }) => q.name)).toEqual([...c.faq]);
    await expect(page.locator('footer')).toContainText(c.trademark);
    await expect(page.locator('footer a', { hasText: c.footer })).toHaveAttribute('href', c.path);
  });

  test(`${c.path}: no horizontal scroll on a phone`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(c.path);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
}

test('the sitemap and /llms.txt list the compare page', async ({ request }) => {
  const xml = await (await request.get('/sitemap.xml')).text();
  for (const loc of ['https://cachedrop.io/cleanmymac-alternative/', 'https://cachedrop.io/fr/cleanmymac-alternative/']) expect(xml).toContain(`<loc>${loc}</loc>`);
  const llms = await (await request.get('/llms.txt')).text();
  expect(llms).toContain('## Compare');
  expect(llms).toContain('/cleanmymac-alternative/)');
  expect(llms).toContain('/fr/cleanmymac-alternative/)');
});
