// Link check of the built site (Decision 27): crawls dist/ from the homepage, including
// fragments and CSS url()s. Absolute https://cachedrop.io URLs (canonical, og:image,
// JSON-LD logo) are checked against the build, since the domain isn't attached until launch.
import { LinkChecker } from 'linkinator';

const PORT = 5799;

// Pages the site links to that later tickets build. Add one per line; remove it when its page lands.
const PENDING = /** @type {string[]} */ ([]);
// Routes vercel.json rewrites to a Vercel function, which a static crawl of dist/ can't reach:
// /buy redirects to Stripe (Decision 41). It is linked from every build now that pricing is always on (Decision 52).
const FUNCTIONS = ['/buy', '/buy/'];
// Webmail the download form's done state opens (Decision 53): Gmail answers a signed-out crawler 401.
const WEBMAIL = ['mail.google.com', 'outlook.live.com'];

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
    const { hostname, pathname: path } = new URL(url, `http://localhost:${PORT}`);
    return PENDING.includes(path) || FUNCTIONS.includes(path) || WEBMAIL.includes(hostname);
  },
});

const broken = result.links.filter((l) => l.state === 'BROKEN');
console.log(`${result.links.length} links checked, ${broken.length} broken.`);
process.exit(broken.length ? 1 : 0);
