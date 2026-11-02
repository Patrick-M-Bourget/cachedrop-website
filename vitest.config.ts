import { defineConfig } from 'vitest/config';

// Vitest covers scripts and functions, the Supabase Edge Function modules included (Decisions 27,
// 40). tests/ holds the Playwright specs.
export default defineConfig({
  test: {
    include: ['scripts/**/*.test.ts', 'src/**/*.test.ts', 'supabase/functions/**/*.test.ts'],
  },
});
