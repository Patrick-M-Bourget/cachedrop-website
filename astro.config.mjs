import { defineConfig } from 'astro/config';

// Static output only (Decision 11). Pages are directories with trailing slashes,
// matching the handoff's root-relative links (`/download/`).
export default defineConfig({
  site: 'https://cachedrop.io',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
});
