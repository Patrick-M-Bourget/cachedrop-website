// Link check of the built site (Decision 27): crawls dist/ from the homepage, including
// fragments and CSS url()s. Absolute https://cachedrop.io URLs (canonical, og:image,
// JSON-LD logo) are checked against the build, since the domain isn't attached until launch.
import { LinkChecker } from 'linkinator';

const PORT = 5799;

// Pages the homepage links to that later tickets build. Remove each line when its page lands.
const PENDING = [
  '/clear-mac-developer-caches/', // #5 guides
  '/clear-adobe-media-cache-mac/', // #5 guides
  '/download/', // #8 email gate
];

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
  linksToSkip: async (url) => PENDING.some((p) => new URL(url, `http://localhost:${PORT}`).pathname === p),
});

const broken = result.links.filter((l) => l.state === 'BROKEN');
console.log(`${result.links.length} links checked, ${broken.length} broken.`);
process.exit(broken.length ? 1 : 0);
