// Every built page the suite checks. Add a page here and it gets the head diff
// (when it has a handoff original) and the screenshot comparisons (when it has
// reference renders in handoff/screenshots/).
export type PageUnderTest = {
  /** URL path on the built site. */
  path: string;
  /** The page in handoff/site/ it ports, relative to handoff/site/. */
  handoff?: string;
  /** Base name of the reference renders: `desktop-<name>.png` (1440 px) and `mobile-<name>.png` (390 px). */
  screenshots?: string;
};

export const pages: PageUnderTest[] = [
  { path: '/', handoff: 'index.html', screenshots: 'home' },
  { path: '/privacy/' }, // no handoff original: token and modal tests only
];
