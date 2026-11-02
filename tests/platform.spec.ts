import { test, expect } from '@playwright/test';
import { pages } from './pages';

// Decisions 35 and 46: the platform claim follows the shipping build. From CacheDrop 1.0.1
// mac-cleaner's Release build is universal (arm64 x86_64) with MACOSX_DEPLOYMENT_TARGET = 14.0
// (mac-cleaner Decisions 144 and 148), so CacheDrop runs on Apple Silicon and Intel Macs with
// macOS 14 or later: the handoff's own claim.
for (const p of pages) {
  test(`${p.path} claims Apple Silicon and Intel on macOS 14, never macOS 26`, async ({ request }) => {
    const html = await (await request.get(p.path)).text();
    expect(html).not.toMatch(/macOS 26/);
    // The footer's Platform column is on every page.
    expect(html).toMatch(/Apple Silicon (&amp;|&|et) Intel/);
    expect(html).toContain('macOS 14');
  });
}

const operatingSystem = { '/': 'macOS 14 or later', '/fr/': 'macOS 14 ou version ultérieure' };

for (const [path, expected] of Object.entries(operatingSystem)) {
  test(`${path} SoftwareApplication JSON-LD names macOS 14 or later`, async ({ page }) => {
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
