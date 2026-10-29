// Every built page the suite checks. Add a page here and it gets the head diff
// (when it has a handoff original) and the screenshot comparisons (when it has
// reference renders in handoff/screenshots/).
export type PageUnderTest = {
  /** URL path on the built site. */
  path: string;
  /** The page in handoff/site/ it ports, relative to handoff/site/. */
  handoff?: string;
  /** A handoff page whose head this page uses, when its body is new (the /download/ form). */
  head?: string;
  /** Base name of the reference renders: `desktop-<name>.png` (1440 px) and `mobile-<name>.png` (390 px). */
  screenshots?: string;
};

export const pages: PageUnderTest[] = [
  { path: '/', handoff: 'index.html', screenshots: 'home' },
  { path: '/clear-mac-developer-caches/', handoff: 'clear-mac-developer-caches/index.html', screenshots: 'developer-guide' },
  { path: '/clear-adobe-media-cache-mac/', handoff: 'clear-adobe-media-cache-mac/index.html', screenshots: 'creator-guide' },
  { path: '/privacy/' }, // no handoff original: token and modal tests only
  { path: '/unsubscribe/' }, // new (Decision 4); vercel.json serves it at /unsubscribe/<token>/
  // The email form (Decision 1) is new; it keeps the handoff download page's head.
  { path: '/download/', head: 'download/index.html' },
  // The token page, which vercel.json serves at /download/<token>/. Without a token it renders the handoff as is.
  { path: '/download/link/', handoff: 'download/index.html', screenshots: 'download' },
];
