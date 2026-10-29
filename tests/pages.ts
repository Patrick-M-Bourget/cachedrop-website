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
  /** Omitted means English. */
  lang?: 'fr';
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
  // French (Decision 5). No handoff originals: token, modal, footer, FAQ and analytics tests.
  { path: '/fr/', lang: 'fr' },
];

/**
 * Each English page and its French twin: where each is built and its canonical address.
 * `pending` marks a twin a later PR of #13 builds: the English side is checked already.
 */
export type Pair = { en: string; fr: string; canonical: { en: string; fr: string }; indexed: boolean; pending?: true };

const pair = (en: string, indexed: boolean, canonical = en, pending?: true): Pair => ({
  en,
  fr: `/fr${en}`,
  canonical: { en: canonical, fr: `/fr${canonical}` },
  indexed,
  ...(pending && { pending }),
});

export const pairs: Pair[] = [
  pair('/', true),
  pair('/clear-mac-developer-caches/', true, undefined, true),
  pair('/clear-adobe-media-cache-mac/', true, undefined, true),
  pair('/privacy/', true, undefined, true),
  pair('/download/', false, undefined, true),
  pair('/download/link/', false, '/download/', true),
  pair('/unsubscribe/', false, undefined, true),
];

/** The shared interface's accessible names in each language, as the per-page tests look them up. */
export const ui = {
  en: {
    home: '/',
    download: '/download/',
    privacy: ['Privacy Policy', '/privacy/'],
    dialog: 'Give Fast Feedback',
    veryUnhappy: 'Very unhappy',
    close: 'Close feedback',
    submit: 'Submit Feedback',
    rating: 'Your rating',
  },
  fr: {
    home: '/fr/',
    download: '/fr/download/',
    privacy: ['Politique de confidentialité', '/fr/privacy/'],
    dialog: 'Donnez-nous votre avis',
    veryUnhappy: 'Très insatisfait',
    close: 'Fermer',
    submit: 'Envoyer',
    rating: 'Votre note',
  },
} as const;

export const uiOf = (p: PageUnderTest) => ui[p.lang ?? 'en'];
