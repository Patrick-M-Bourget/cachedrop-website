import { test, expect } from '@playwright/test';
import { pages } from './pages';

// HANDOFF.md §4: the visible FAQ text matches the FAQPage structured data, word for word.
for (const p of pages) {
  test(`${p.path} shows the same FAQ as its FAQPage JSON-LD`, async ({ page }) => {
    await page.goto(p.path);
    const { structured, visible } = await page.evaluate(() => {
      const graphs = [...document.querySelectorAll('script[type="application/ld+json"]')].flatMap((s) => {
        const data = JSON.parse(s.textContent ?? '{}');
        return data['@graph'] ?? [data];
      });
      const faq = graphs.find((g) => g['@type'] === 'FAQPage');
      const structured = (faq?.mainEntity ?? []).map((q: { name: string; acceptedAnswer: { text: string } }) => [q.name, q.acceptedAnswer.text]);
      const visible = [...document.querySelectorAll('#faq h3')].map((h) => [h.textContent, h.nextElementSibling?.textContent]);
      return { structured, visible };
    });
    test.skip(structured.length === 0, 'no FAQPage on this page');
    expect(visible).toEqual(structured);
  });
}
