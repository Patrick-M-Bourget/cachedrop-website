import { defineConfig, devices } from '@playwright/test';

// PORT lets parallel worktrees each run their own preview instead of reusing another's.
const PORT = Number(process.env.PORT ?? 4321);
// Decision 44: a second build with the launch setting on (PUBLIC_PRICING_LIVE=1), in its own
// directory and preview on the next port. The `pricing-live` project runs tests/pricing-live.spec.ts
// against it; every other spec runs against the default build, where the setting is off.
const LIVE_PORT = PORT + 1;
const LIVE_SPEC = /pricing-live\.spec\.ts/;

export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  // The reference renders live in the design handoff and are never rewritten by a test run.
  updateSnapshots: 'none',
  snapshotPathTemplate: 'handoff/screenshots/{arg}{ext}',
  use: {
    // PREVIEW_URL points the run at a Vercel preview instead (tests/gate-journey.spec.ts).
    baseURL: process.env.PREVIEW_URL ?? `http://localhost:${PORT}`,
    ...devices['Desktop Chrome'],
  },
  projects: process.env.PREVIEW_URL
    ? [{ name: 'site', testIgnore: LIVE_SPEC }]
    : [
        { name: 'site', testIgnore: LIVE_SPEC },
        { name: 'pricing-live', testMatch: LIVE_SPEC, use: { baseURL: `http://localhost:${LIVE_PORT}` } },
      ],
  webServer: process.env.PREVIEW_URL
    ? undefined
    : [
        {
          command: `npx astro preview --port ${PORT} --ignore-lock`,
          url: `http://localhost:${PORT}/`,
          reuseExistingServer: !process.env.CI,
        },
        {
          command: `PUBLIC_PRICING_LIVE=1 npx astro build --outDir dist-pricing-live && npx astro preview --outDir dist-pricing-live --port ${LIVE_PORT} --ignore-lock`,
          url: `http://localhost:${LIVE_PORT}/`,
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
        },
      ],
});
