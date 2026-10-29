import { test, expect } from '@playwright/test';
import { pages } from './pages';

// Decision 35: the platform claim follows the shipping build. mac-cleaner's Release
// configuration is ARCHS = arm64, MACOSX_DEPLOYMENT_TARGET = 26.0, so CacheDrop runs on
// Apple Silicon Macs with macOS 26 or later. When mac-cleaner #322 (lower minimum) or
// #323 (Intel) lands, this spec changes with the copy.
for (const p of pages) {
  test(`${p.path} claims Apple Silicon and macOS 26, never Intel or macOS 14`, async ({ request }) => {
    const html = await (await request.get(p.path)).text();
    expect(html).not.toMatch(/\bIntel\b/);
    expect(html).not.toMatch(/macOS 14|Sonoma/);
    // The footer's Platform column is on every page.
    expect(html).toContain('Apple Silicon');
    expect(html).toContain('macOS 26');
  });
}

const operatingSystem = { '/': 'macOS 26 or later', '/fr/': 'macOS 26 ou version ultérieure' };

for (const [path, expected] of Object.entries(operatingSystem)) {
  test(`${path} SoftwareApplication JSON-LD names macOS 26 or later`, async ({ page }) => {
    await page.goto(path);
    const app = await page.evaluate(() =>
      [...document.querySelectorAll('script[type="application/ld+json"]')]
        .flatMap((s) => {
          const data = JSON.parse(s.textContent ?? '{}');
          return data['@graph'] ?? [data];
        })
        .find((g) => g['@type'] === 'SoftwareApplication'),
    );
    expect(app?.operatingSystem).toBe(expected);
  });
}
