import { test, expect } from '@playwright/test';
import { footerCopy } from '../src/components/footer';
import { guides } from '../src/components/guides';
import { pricingCopy } from '../src/components/pricing';

// #94 (Decision 48): the site is open to AI answer engines, and says so by name.
const aiCrawlers = ['GPTBot', 'OAI-SearchBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended'];

/** robots.txt as groups: the user agents a group names and its rules (RFC 9309). */
function robotsGroups(text: string) {
  const groups: Array<{ agents: string[]; rules: string[] }> = [];
  let open = false;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) continue;
    const [key, ...rest] = line.split(':');
    const field = key.trim().toLowerCase();
    const value = rest.join(':').trim();
    if (field === 'user-agent') {
      if (!open) groups.push({ agents: [], rules: [] });
      groups.at(-1)!.agents.push(value);
      open = true;
    } else {
      if (field === 'allow' || field === 'disallow') groups.at(-1)?.rules.push(`${field}: ${value}`);
      open = false;
    }
  }
  return groups;
}

test('robots.txt allows every crawler, naming each AI crawler', async ({ request }) => {
  const response = await request.get('/robots.txt');
  expect(response.ok()).toBe(true);
  const text = await response.text();
  const groups = robotsGroups(text);
  for (const agent of ['*', ...aiCrawlers]) {
    const group = groups.filter((g) => g.agents.includes(agent));
    expect(group, agent).toHaveLength(1);
    expect(group[0].rules, agent).toEqual(['allow: /']);
  }
  expect(text).toContain('Sitemap: https://cachedrop.io/sitemap.xml');
});

// Decision 51: /llms.txt states the same price and platform as the pricing section and the footer.
test.describe('/llms.txt', () => {
  test('is served as plain text and links only to pages that exist', async ({ request }) => {
    const response = await request.get('/llms.txt');
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toMatch(/^text\/plain/);
    const text = await response.text();
    expect(text).toMatch(/^# CacheDrop\n\n> /);
    const urls = [...text.matchAll(/\]\((https:\/\/cachedrop\.io[^)]*)\)/g)].map(([, url]) => new URL(url).pathname);
    expect(urls.length).toBeGreaterThan(5);
    // /buy is a Vercel function (Decision 41) that a local preview doesn't serve.
    for (const path of urls.filter((u) => u !== '/buy')) expect((await request.get(path)).status(), path).toBe(200);
  });

  test('states the price in pricing.ts, and no other', async ({ request }) => {
    const text = await (await request.get('/llms.txt')).text();
    expect(text).toContain(`A license is ${pricingCopy.en.license}, for up to 3 Macs.`);
    const amounts = new Set(text.match(/\$\s?\d+(?:[.,]\d+)?|\d+[.,]\d{2}\s?\$/g));
    // The French lines (the compare page's description) write the same two numbers the French way.
    const fr = [pricingCopy.fr.was, pricingCopy.fr.now].map((a) => a.replace('\u00a0', ' '));
    expect([...amounts].map((a) => a.replace('\u00a0', ' ')).sort()).toEqual([...new Set([pricingCopy.en.was, pricingCopy.en.now, ...fr])].sort());
    // The Mac count is the pricing section's ("Use it on up to 3 of your Macs").
    const macs = /up to (\d+) of your Macs/.exec(pricingCopy.en.items.join('\n'))![1];
    for (const [, n] of text.matchAll(/(\d+) (?:of your )?Macs\b/g)) expect(n).toBe(macs);
  });

  test('states the platform in the footer, and no other', async ({ page, request }) => {
    const text = await (await request.get('/llms.txt')).text();
    await page.goto('/');
    const column = page.getByRole('contentinfo').locator('div', { has: page.getByRole('heading', { name: 'Platform', exact: true }) }).last();
    const lines = await column.locator('span').allTextContents();
    expect(lines).toEqual([footerCopy.en.chips, footerCopy.en.macos]);
    const platform = text.split('## Platform\n\n')[1]?.split('\n\n')[0] ?? '';
    for (const line of lines) expect(platform, 'the footer\'s Platform column').toContain(`- ${line}\n`);
    const macos = /macOS (\d+)/.exec(lines.join(' '))![1];
    for (const [, n] of text.matchAll(/macOS (\d+)/g)) expect(n, 'every macOS version named').toBe(macos);
    for (const chip of ['Apple Silicon', 'Intel']) expect(lines.join(' ').includes(chip)).toBe(text.includes(chip));
  });

  test('names each guide the footer links to, at its address, with its description', async ({ page, request }) => {
    const text = await (await request.get('/llms.txt')).text();
    for (const lang of ['en', 'fr'] as const) {
      await page.goto(lang === 'en' ? '/' : '/fr/');
      const nav = page.getByRole('contentinfo').getByRole('navigation', { name: 'Cleaning guides' });
      const links = await nav.getByRole('link').evaluateAll((as) => as.map((a) => [a.textContent!.trim(), a.getAttribute('href')!]));
      expect(links).toHaveLength(Object.keys(guides).length);
      for (const [name, href] of links) {
        const guide = Object.values(guides).find((g) => href.endsWith(g.path))!;
        expect(text, href).toContain(`- [${name}](https://cachedrop.io${href}): ${guide[lang].description}\n`);
        await page.goto(href);
        await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', guide[lang].description);
        await page.goBack();
      }
    }
  });
});
