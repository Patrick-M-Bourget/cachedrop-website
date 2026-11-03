// Head props shared by the form at /download/ and the token page that /download/<token>/ is
// rewritten to (vercel.json). Both are the handoff's download page head (noindex, canonical /download/),
// in each language (Decision 5).

const shared = { path: '/download/', robots: 'noindex, follow' };

export const downloadHead = {
  en: {
    ...shared,
    title: 'Download CacheDrop for Mac',
    description: 'Download CacheDrop for Mac: a universal app for Apple Silicon and Intel Macs on macOS 14 or later.',
  },
  fr: {
    ...shared,
    title: 'Télécharger CacheDrop pour Mac',
    description: 'Téléchargez CacheDrop pour Mac : une application universelle pour les Mac Apple Silicon et Intel sous macOS 14 ou version ultérieure.',
  },
};

/** The line under the title on both pages: architectures and macOS. The trial line is stated once, in the email (Decision 51). */
export const downloadMeta = {
  en: ['Universal: Apple Silicon & Intel', 'macOS 14 Sonoma or later'],
  fr: ['Universelle : Apple Silicon et Intel', 'macOS 14 Sonoma ou version ultérieure'],
};

/** The links to the guides at the bottom of both pages. */
export const guideLinks = {
  en: ['Clear Developer Caches guide', 'Clear Adobe Media Cache guide', 'Clear System Data guide'],
  fr: ['Guide pour vider les caches de développement', 'Guide pour vider le cache de média Adobe', 'Guide pour vider les Données système'],
};
