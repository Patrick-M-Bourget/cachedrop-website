import { defineConfig } from 'vitest/config';

// Vitest covers scripts and functions (Decision 27). tests/ holds the Playwright specs.
export default defineConfig({
  test: {
    include: ['scripts/**/*.test.ts', 'src/**/*.test.ts'],
  },
});
