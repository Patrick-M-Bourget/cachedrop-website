// Link check of the built site (Decision 27): crawls dist/ from the homepage, including
// fragments and CSS url()s. Absolute https://cachedrop.io URLs (canonical, og:image,
// JSON-LD logo) are checked against the build, since the domain isn't attached until launch.
import { LinkChecker } from 'linkinator';

const PORT = 5799;

// Pages the site links to that later tickets build. Add one per line; remove it when its page lands.
// The French twins of #13's later PRs (Decision 5): the footer's language switch already links to them.
const PENDING = /** @type {string[]} */ ([
  '/fr/privacy/',
  '/fr/download/',
  '/fr/unsubscribe/',
]);

// Served by Vercel itself once Web Analytics is on (Decision 16); never in the build.
const VERCEL_ONLY = ['/_vercel/insights/script.js'];

const checker = new LinkChecker();
checker.on('link', (link) => {
  if (link.state === 'BROKEN') console.error(`[${link.status}] ${link.url} (from ${link.parent})`);
});

const result = await checker.check({
  path: 'dist',
  port: PORT,
  recurse: true,
  checkFragments: true,
  checkCss: true,
  urlRewriteExpressions: [{ pattern: /^https:\/\/cachedrop\.io/, replacement: `http://localhost:${PORT}` }],
  linksToSkip: async (url) => {
    const path = new URL(url, `http://localhost:${PORT}`).pathname;
    return PENDING.includes(path) || VERCEL_ONLY.some((p) => path.endsWith(p));
  },
});

const broken = result.links.filter((l) => l.state === 'BROKEN');
console.log(`${result.links.length} links checked, ${broken.length} broken.`);
process.exit(broken.length ? 1 : 0);
