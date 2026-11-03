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
  // The homepage (#109, Decision 51) is a new layout: its own reference renders, no handoff original.
  { path: '/', screenshots: 'home' },
  { path: '/clear-mac-developer-caches/', handoff: 'clear-mac-developer-caches/index.html', screenshots: 'developer-guide' },
  { path: '/clear-adobe-media-cache-mac/', handoff: 'clear-adobe-media-cache-mac/index.html', screenshots: 'creator-guide' },
  { path: '/uninstall-audio-plugins-mac/' }, // the producer page (Decision 48): no handoff original
  { path: '/clear-system-data-mac/' }, // the System Data guide (#110): no handoff original
  { path: '/uninstall-apps-mac/' }, // the app uninstall guide (#111): no handoff original
  { path: '/cleanmymac-alternative/' }, // the compare page (Decision 54): no handoff original
  { path: '/privacy/' }, // no handoff original: token and modal tests only
  { path: '/unsubscribe/' }, // new (Decision 4); vercel.json serves it at /unsubscribe/<token>/
  // The email form (Decision 1) is new; it keeps the handoff download page's head.
  { path: '/download/', head: 'download/index.html' },
  // The token page, which vercel.json serves at /download/<token>/. Without a token it renders the handoff as is.
  { path: '/download/link/', handoff: 'download/index.html', screenshots: 'download' },
  // The draft sale pages (Decision 43): no handoff originals.
  { path: '/terms-of-sale/' },
  { path: '/refund-policy/' },
  { path: '/license-agreement/' },
  { path: '/resend-license-key/' }, // new (Decision 42): no handoff original
  // French (Decision 5). No handoff originals: token, modal, footer, FAQ and analytics tests.
  { path: '/fr/', lang: 'fr' },
  { path: '/fr/clear-mac-developer-caches/', lang: 'fr' },
  { path: '/fr/clear-adobe-media-cache-mac/', lang: 'fr' },
  { path: '/fr/uninstall-audio-plugins-mac/', lang: 'fr' },
  { path: '/fr/clear-system-data-mac/', lang: 'fr' },
  { path: '/fr/uninstall-apps-mac/', lang: 'fr' },
  { path: '/fr/cleanmymac-alternative/', lang: 'fr' },
  { path: '/fr/privacy/', lang: 'fr' },
  { path: '/fr/unsubscribe/', lang: 'fr' },
  { path: '/fr/download/', lang: 'fr' },
  { path: '/fr/download/link/', lang: 'fr' },
  { path: '/fr/terms-of-sale/', lang: 'fr' },
  { path: '/fr/refund-policy/', lang: 'fr' },
  { path: '/fr/license-agreement/', lang: 'fr' },
  { path: '/fr/resend-license-key/', lang: 'fr' },
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
  pair('/uninstall-audio-plugins-mac/', true),
  pair('/clear-system-data-mac/', true),
  pair('/uninstall-apps-mac/', true),
  pair('/cleanmymac-alternative/', true),
  pair('/privacy/', true),
  pair('/download/', false),
  pair('/download/link/', false, '/download/'),
  pair('/unsubscribe/', false),
  pair('/terms-of-sale/', true),
  pair('/refund-policy/', true),
  pair('/license-agreement/', true),
  pair('/resend-license-key/', false),
];

/** The shared interface's accessible names in each language, as the per-page tests look them up. */
export const ui = {
  en: {
    home: '/',
    download: '/download/',
    privacy: ['Privacy Policy', '/privacy/'],
    legal: [
      ['Terms of Sale', '/terms-of-sale/'],
      ['Refund Policy', '/refund-policy/'],
      ['License Agreement', '/license-agreement/'],
    ],
    resendKey: ['Resend License Key', '/resend-license-key/'],
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
    legal: [
      ['Conditions de vente', '/fr/terms-of-sale/'],
      ['Politique de remboursement', '/fr/refund-policy/'],
      ['Contrat de licence', '/fr/license-agreement/'],
    ],
    resendKey: ['Renvoyer la clé de licence', '/fr/resend-license-key/'],
    dialog: 'Donnez-nous votre avis',
    veryUnhappy: 'Très insatisfait',
    close: 'Fermer',
    submit: 'Envoyer mon avis',
    rating: 'Votre note',
  },
} as const;

export const uiOf = (p: PageUnderTest) => ui[p.lang ?? 'en'];
