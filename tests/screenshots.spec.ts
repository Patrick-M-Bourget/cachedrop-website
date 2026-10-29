import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pages } from './pages';

// Decision 11: the rendered pages match the handoff at 1440 and 390 px.
// The reference renders are desktop at 1x and mobile at 2x.
const VIEWPORTS = [
  { kind: 'desktop', width: 1440, scale: 1 },
  { kind: 'mobile', width: 390, scale: 2 },
] as const;

async function pngSize(file: string) {
  const buf = await readFile(file);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
}

/** Serves handoff/site/ at http://handoff.test/ so the original renders in this same browser. */
async function serveHandoff(page: Page) {
  await page.route('http://handoff.test/**', async (route) => {
    let path = new URL(route.request().url()).pathname;
    if (path.endsWith('/')) path += 'index.html';
    try {
      await route.fulfill({ path: join('handoff/site', decodeURIComponent(path)) });
    } catch {
      await route.fulfill({ status: 404 });
    }
  });
}

/** Counts pixels that differ by more than `tolerance` on any channel, using the page's canvas. */
async function diffPixels(page: Page, a: Buffer, b: Buffer, tolerance = 0) {
  return page.evaluate(
    async ([a64, b64, tol]) => {
      const load = async (b64: string) => createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
      const [ia, ib] = await Promise.all([load(a64 as string), load(b64 as string)]);
      if (ia.width !== ib.width || ia.height !== ib.height)
        return { sizes: `${ia.width}x${ia.height} vs ${ib.width}x${ib.height}`, count: -1 };
      const read = (img: ImageBitmap) => {
        const c = new OffscreenCanvas(img.width, img.height).getContext('2d')!;
        c.drawImage(img, 0, 0);
        return c.getImageData(0, 0, img.width, img.height).data;
      };
      const [da, db] = [read(ia), read(ib)];
      let count = 0;
      let first = -1;
      for (let i = 0; i < da.length; i += 4) {
        const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
        if (d > (tol as number)) {
          count++;
          if (first < 0) first = i / 4;
        }
      }
      return { sizes: `${ia.width}x${ia.height}`, count, firstRow: first < 0 ? null : Math.floor(first / ia.width) };
    },
    [a.toString('base64'), b.toString('base64'), tolerance] as const,
  );
}

for (const p of pages) {
  for (const v of VIEWPORTS) {
    test.describe(`${p.path} at ${v.width} px`, () => {
      test.use({ viewport: { width: v.width, height: 900 }, deviceScaleFactor: v.scale });

      test('matches the reference render in handoff/screenshots/', async ({ page }) => {
        test.skip(!p.screenshots, 'no reference render in handoff/screenshots/');
        // Size the viewport to the reference so the capture has its exact dimensions;
        // a page a pixel taller or shorter then shows up as a pixel difference, not a size error.
        const ref = await pngSize(`handoff/screenshots/${v.kind}-${p.screenshots}.png`);
        await page.setViewportSize({ width: v.width, height: Math.round(ref.height / v.scale) });
        await page.goto(p.path);
        await settle(page);
        // The reference was rendered on another machine, so text antialiasing differs a little.
        // These limits pass the handoff page itself and fail a changed colour, size or layout.
        await expect(page).toHaveScreenshot(`${v.kind}-${p.screenshots}.png`, {
          threshold: 0.1,
          maxDiffPixelRatio: 0.003,
          scale: 'device',
        });
      });

      test('renders the same as the handoff original in this browser', async ({ page, browser }) => {
        test.skip(!p.handoff, 'no handoff original');
        await page.goto(p.path);
        await settle(page);
        const built = await page.screenshot({ fullPage: true });

        const original = await browser.newPage({ viewport: { width: v.width, height: 900 }, deviceScaleFactor: v.scale });
        await serveHandoff(original);
        await original.goto(`http://handoff.test/${p.handoff}`);
        await settle(original);
        const expected = await original.screenshot({ fullPage: true });
        await original.close();

        const result = await diffPixels(page, built, expected);
        if (result.count !== 0) {
          await test.info().attach('built.png', { body: built, contentType: 'image/png' });
          await test.info().attach('handoff.png', { body: expected, contentType: 'image/png' });
        }
        expect(result).toMatchObject({ count: 0 });
      });
    });
  }
}
