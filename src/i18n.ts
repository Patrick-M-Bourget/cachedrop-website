// The site's languages (Decision 5, amended for German): English at /, French at /fr/, German at /de/.
// A page that exists in more than one lives once under src/pages/[...lang]/ and picks its strings with
// `langOf(Astro.url)`. French covers every page; German covers the core pages in `dePages` (headquarters-app
// seo-growth-plan Q26), and the others link to their English page from German pages.

export type Lang = 'en' | 'fr' | 'de';
/** The languages forms, emails and checkout speak. German pages use the English flows for now. */
export type FlowLang = 'en' | 'fr';

/** The value of <html lang>: the French is Quebec French, the German is Germany's. */
export const htmlLang: Record<Lang, string> = { en: 'en', fr: 'fr-CA', de: 'de-DE' };

/** Each language's name in itself, for the language switch. */
export const langName: Record<Lang, string> = { en: 'English', fr: 'Français', de: 'Deutsch' };

/** English paths of the pages built in German. */
export const dePages: ReadonlySet<string> = new Set([
  '/', '/pricing/', '/cleanmymac-alternative/', '/clear-mac-developer-caches/', '/clear-adobe-media-cache-mac/',
  '/clear-system-data-mac/', '/uninstall-apps-mac/', '/uninstall-audio-plugins-mac/',
]);

/** getStaticPaths for a page under src/pages/[...lang]/: one build at /, one at /fr/. */
export const langPaths = () => [{ params: { lang: undefined } }, { params: { lang: 'fr' } }];
/** getStaticPaths for a page in `dePages`: also one at /de/. */
export const langPathsDe = () => [...langPaths(), { params: { lang: 'de' } }];

const prefixed = (url: URL, p: string) => url.pathname === `/${p}` || url.pathname.startsWith(`/${p}/`);
/** The language of the page at `url`. */
export const langOf = (url: URL): Lang => (prefixed(url, 'fr') ? 'fr' : prefixed(url, 'de') ? 'de' : 'en');

/** The language a form, email or checkout reached from a page in `lang` speaks. */
export const flowLang = (lang: Lang): FlowLang => (lang === 'fr' ? 'fr' : 'en');

/** Whether the page at English `path` exists in `lang`. Fragments and queries are ignored. */
export const hasPage = (lang: Lang, path: string) => lang !== 'de' || dePages.has(path.replace(/[?#].*$/, ''));

/** A root-relative English path, e.g. `/download/`, in `lang`; a page not built in German stays English.
 *  Fragments and `#feedback` pass through. */
export const localize = (lang: Lang, path: string) =>
  lang === 'en' || !path.startsWith('/') || !hasPage(lang, path) ? path : `/${lang}${path}`;

/** The languages the page at English `path` exists in, in switch order. */
export const langsOf = (path: string): Lang[] => (['en', 'fr', 'de'] as Lang[]).filter(l => hasPage(l, path));
