import { defineConfig } from 'astro/config';
import { pricingSitemap } from './scripts/pricing-sitemap.mjs';

// Static output only (Decision 11). Pages are directories with trailing slashes,
// matching the handoff's root-relative links (`/download/`).
export default defineConfig({
  site: 'https://cachedrop.io',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
  // Decision 44: the pricing pages join the built sitemap only when the launch setting is on.
  integrations: [pricingSitemap(process.env.PUBLIC_PRICING_LIVE === '1')],
});
