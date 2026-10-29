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
  { path: '/fr/clear-mac-developer-caches/', lang: 'fr' },
  { path: '/fr/clear-adobe-media-cache-mac/', lang: 'fr' },
  { path: '/fr/privacy/', lang: 'fr' },
  { path: '/fr/unsubscribe/', lang: 'fr' },
  { path: '/fr/download/', lang: 'fr' },
  { path: '/fr/download/link/', lang: 'fr' },
];

/** Each English page and its French twin: where each is built and its canonical address. */
export type Pair = { en: string; fr: string; canonical: { en: string; fr: string }; indexed: boolean };

const pair = (en: string, indexed: boolean, canonical = en): Pair => ({
  en,
  fr: `/fr${en}`,
  canonical: { en: canonical, fr: `/fr${canonical}` },
  indexed,
});

export const pairs: Pair[] = [
  pair('/', true),
  pair('/clear-mac-developer-caches/', true),
  pair('/clear-adobe-media-cache-mac/', true),
  pair('/privacy/', true),
  pair('/download/', false),
  pair('/download/link/', false, '/download/'),
  pair('/unsubscribe/', false),
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
    submit: 'Envoyer mon avis',
    rating: 'Votre note',
  },
} as const;

export const uiOf = (p: PageUnderTest) => ui[p.lang ?? 'en'];
