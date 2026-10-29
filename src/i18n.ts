// The site's two languages (Decision 5): English at /, French at /fr/. A page that exists in
// both lives once under src/pages/[...lang]/ and picks its strings with `langOf(Astro.url)`.

export type Lang = 'en' | 'fr';

/** The value of <html lang>: the French is Quebec French. */
export const htmlLang: Record<Lang, string> = { en: 'en', fr: 'fr-CA' };

/** getStaticPaths for a page under src/pages/[...lang]/: one build at /, one at /fr/. */
export const langPaths = () => [{ params: { lang: undefined } }, { params: { lang: 'fr' } }];

/** The language of the page at `url`. */
export const langOf = (url: URL): Lang => (url.pathname === '/fr' || url.pathname.startsWith('/fr/') ? 'fr' : 'en');

/** A root-relative English path, e.g. `/download/`, in `lang`. Fragments and `#feedback` pass through. */
export const localize = (lang: Lang, path: string) => (lang === 'en' || !path.startsWith('/') ? path : `/fr${path}`);

/** The other language, for the language switch. */
export const other = (lang: Lang): Lang => (lang === 'en' ? 'fr' : 'en');
