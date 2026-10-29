import { defineConfig, devices } from '@playwright/test';

// PORT lets parallel worktrees each run their own preview instead of reusing another's.
const PORT = Number(process.env.PORT ?? 4321);

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
    baseURL: `http://localhost:${PORT}`,
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: `npx astro preview --port ${PORT} --ignore-lock`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
  },
});
