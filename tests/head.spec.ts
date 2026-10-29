import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pages } from './pages';
import { withHandoffChanges } from './handoff-changes';

// Decision 18: the agreed head changes are cachedrop.app -> cachedrop.io, plus the
// copy fixes in copy-fixes.ts (Decision 23), which also reach descriptions and JSON-LD.
// The other changes in handoff-changes.ts are body-only, so they don't touch the head.
const toProductionDomain = (html: string) => html.replaceAll('cachedrop.app', 'cachedrop.io');

/**
 * The head as a list of comparable entries. Stylesheets are left out: the token
 * port (Decision 11) changes how styles are delivered, not the head tags.
 */
async function headEntries(page: Page, html: string) {
  return page.evaluate((source) => {
    const doc = new DOMParser().parseFromString(source, 'text/html');
    return [...doc.head.children]
      .filter((el) => el.tagName !== 'STYLE')
      .filter((el) => !(el.tagName === 'LINK' && el.getAttribute('href')?.startsWith('/_astro/')))
      .map((el) => {
        const attrs = [...el.attributes].map((a) => `${a.name}=${a.value}`).sort();
        let text = el.textContent?.trim() ?? '';
        if (el.getAttribute('type') === 'application/ld+json') text = JSON.stringify(JSON.parse(text));
        return { tag: el.tagName.toLowerCase(), attrs, text };
      });
  }, html);
}

for (const p of pages.filter((p) => p.handoff || p.head)) {
  const handoff = (p.head ?? p.handoff)!;
  test(`head of ${p.path} matches the handoff apart from the .io domain and copy fixes`, async ({ page, request }) => {
    const built = await (await request.get(p.path)).text();
    const original = toProductionDomain(withHandoffChanges(handoff, await readFile(`handoff/site/${handoff}`, 'utf8')));
    await page.goto('about:blank');
    expect(await headEntries(page, built)).toEqual(await headEntries(page, original));
  });
}
