// Head props shared by the form at /download/ and the token page that /download/<token>/ is
// rewritten to (vercel.json). Both are the handoff's download page head (noindex, canonical /download/),
// in each language (Decision 5).
const shared = { path: '/download/', robots: 'noindex, follow' };

export const downloadHead = {
  en: {
    ...shared,
    title: 'Download CacheDrop for Mac',
    description: 'Download the free CacheDrop beta for Apple Silicon Macs on macOS 26 or later.',
  },
  fr: {
    ...shared,
    title: 'Télécharger CacheDrop pour Mac',
    description: 'Téléchargez la bêta gratuite de CacheDrop pour les Mac Apple Silicon sous macOS 26 ou version ultérieure.',
  },
};

/** The line under the title on both pages: price, architectures, macOS. */
export const downloadMeta = {
  en: ['Free while in beta', 'Apple Silicon', 'macOS 26 or later'],
  fr: ['Gratuit pendant la bêta', 'Apple Silicon', 'macOS 26 ou version ultérieure'],
};

/** The links to the guides at the bottom of both pages. */
export const guideLinks = {
  en: ['Clear Developer Caches guide', 'Clear Adobe Media Cache guide'],
  fr: ['Guide pour vider les caches de développement', 'Guide pour vider le cache de média Adobe'],
};
