// The CleanMyMac alternative page's price table (#87, Decision 54). Each row is a product's list price
// for one license in US dollars, before tax, read from its maker's own page (`source`) on `checkedOn`.
// The display strings and the 3-year cost are built from the numbers, so they can't disagree.
// CacheDrop's row reads `price` from pricing.ts at the regular price (Decision 47): the limited-time
// offer shows only in the offer note. Prices are rechecked quarterly; compare.test.ts fails once a row is over 120 days old (#90).
import { price, pricingCopy } from './pricing';
import type { Lang } from '../i18n';

/** The page's meta description, also its /llms.txt line (Decision 54): built from the price. */
export const compareDescription: Record<Lang, string> = {
  en: `CacheDrop cleans your Mac, uninstalls apps and plug-ins completely, and clears developer and media caches for ${pricingCopy.en.license}, on up to 3 Macs. No subscription.`,
  fr: `CacheDrop nettoie votre Mac, désinstalle complètement applications et plug-ins, et vide les caches de développement et de média pour ${pricingCopy.fr.license}, sur un maximum de 3 Mac. Aucun abonnement.`,
};

export type Plan = {
  /** A one-time price. */
  once?: number;
  /** A yearly price, and the first year's when it differs. */
  yearly?: number;
  firstYear?: number;
};

export type CompareRow = {
  product: string;
  /** Which of the product's plans this row is, after its name, e.g. "(one-time)". */
  edition?: Record<Lang, string>;
  us?: true;
  plan: Plan;
  /** Macs one license covers. */
  macs: number;
  goodFor: Record<Lang, string>;
  source: string;
  /** The day the price was read from `source`, YYYY-MM-DD. */
  checkedOn: string;
};

/** The row's name in `lang`, e.g. "CleanMyMac (one-time)". */
export const productName = (lang: Lang, r: CompareRow) => (r.edition ? `${r.product} (${r.edition[lang]})` : r.product);

/** The oldest `checkedOn`: the note under the table can't claim a fresher check than every row had. */
export const checkedOn = () => rows.map((r) => r.checkedOn).sort()[0];

/** How old a price check may get before the check fails (#90): a quarter plus a month to act on it. */
export const maxCheckAgeDays = 120;

/** The rows checked more than `maxCheckAgeDays` before `today`, each as "Product (source): checked YYYY-MM-DD, N days ago". */
export function staleRows(today: Date, list: CompareRow[] = rows): string[] {
  const day = 24 * 60 * 60 * 1000;
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return list.flatMap((r) => {
    const age = Math.round((todayUtc - Date.parse(`${r.checkedOn}T00:00:00Z`)) / day);
    return age > maxCheckAgeDays ? [`${productName('en', r)} (${r.source}): checked ${r.checkedOn}, ${age} days ago`] : [];
  });
}

/** The cheapest way to cover one Mac for three years at list price; 0 for a free tool. */
export const threeYears = ({ once, yearly, firstYear }: Plan): number => {
  const options = [once, yearly === undefined ? undefined : (firstYear ?? yearly) + 2 * yearly].filter((n) => n !== undefined);
  return options.length ? Math.min(...options) : 0;
};

export const rows: CompareRow[] = [
  {
    product: 'CacheDrop',
    us: true,
    plan: { once: Number(price.regular) },
    macs: 3,
    goodFor: {
      en: 'Cleanup, complete app and plug-in uninstalls, and developer and media caches, in one app.',
      fr: 'Le nettoyage, la désinstallation complète d’applications et de plug-ins, et les caches de développement et de média, dans une seule application.',
    },
    source: 'https://cachedrop.io/pricing/',
    checkedOn: '2026-11-03',
  },
  {
    product: 'CleanMyMac',
    plan: { yearly: 39.95 },
    macs: 1,
    goodFor: {
      en: 'An all-in-one suite: cleanup, malware scans, an app updater and system monitors.',
      fr: 'Une suite tout-en-un : nettoyage, analyse antimaliciel, mise à jour des applications et moniteurs système.',
    },
    source: 'https://macpaw.com/cleanmymac',
    checkedOn: '2026-11-02',
  },
  {
    product: 'CleanMyMac Essential Trio',
    plan: { yearly: 19.95 },
    macs: 1,
    goodFor: {
      en: 'CleanMyMac’s lower-priced plan, with fewer tools.',
      fr: 'L’offre moins chère de CleanMyMac, avec moins d’outils.',
    },
    source: 'https://macpaw.com/cleanmymac',
    checkedOn: '2026-11-02',
  },
  {
    product: 'CleanMyMac',
    edition: { en: 'one-time', fr: 'licence unique' },
    plan: { once: 119.95 },
    macs: 1,
    goodFor: {
      en: 'The same suite, paid once. The next major version is a paid upgrade.',
      fr: 'La même suite, payée une fois. La prochaine version majeure est une mise à niveau payante.',
    },
    source: 'https://macpaw.com/support/cleanmymac/knowledgebase/purchase-options',
    checkedOn: '2026-11-02',
  },
  {
    product: 'MacKeeper',
    plan: { firstYear: 71.4, yearly: 95.4 },
    macs: 1,
    goodFor: {
      en: 'Cleanup bundled with antivirus, a VPN and an ad blocker.',
      fr: 'Le nettoyage, avec un antivirus, un RPV et un bloqueur de publicités.',
    },
    source: 'https://mackeeper.com/pricing',
    checkedOn: '2026-11-02',
  },
  {
    product: 'BuhoCleaner',
    plan: { yearly: 39.99, once: 67.99 },
    macs: 1,
    goodFor: {
      en: 'Cleanup and app uninstalls, yearly or paid once.',
      fr: 'Le nettoyage et la désinstallation d’applications, à l’année ou payés une fois.',
    },
    source: 'https://www.drbuho.com/buhocleaner/buy',
    checkedOn: '2026-11-02',
  },
  {
    product: 'MacCleaner Pro',
    plan: { yearly: 39.95, once: 85.95 },
    macs: 1,
    goodFor: {
      en: 'A bundle of six tools, including a memory cleaner and a duplicate finder.',
      fr: 'Un ensemble de six outils, dont un nettoyeur de mémoire et un chercheur de doublons.',
    },
    source: 'https://nektony.com/store',
    checkedOn: '2026-11-02',
  },
  {
    product: 'App Cleaner & Uninstaller',
    plan: { yearly: 14.95, once: 34.95 },
    macs: 1,
    goodFor: {
      en: 'Removing apps and the files they leave behind.',
      fr: 'Supprimer des applications et les fichiers qu’elles laissent derrière elles.',
    },
    source: 'https://nektony.com/mac-app-cleaner/buy2d',
    checkedOn: '2026-11-02',
  },
  {
    product: 'Sensei',
    plan: { yearly: 29, once: 59 },
    macs: 3,
    goodFor: {
      en: 'System monitoring and performance tools, with cleanup.',
      fr: 'La surveillance du système et des outils de performance, avec du nettoyage.',
    },
    source: 'https://cindori.com/store/sensei',
    checkedOn: '2026-11-03',
  },
  {
    product: 'Mole',
    plan: { once: 19 },
    macs: 2,
    goodFor: {
      en: 'Cleanup plus system monitors and fan control, for 2 Macs.',
      fr: 'Le nettoyage, plus des moniteurs système et le contrôle des ventilateurs, pour 2 Mac.',
    },
    source: 'https://mole.fit/',
    checkedOn: '2026-11-03',
  },
  {
    product: 'DaisyDisk',
    plan: { once: 9.99 },
    macs: 5,
    goodFor: {
      en: 'A visual map of your disk. You find and delete files yourself.',
      fr: 'Une carte visuelle de votre disque. Vous trouvez et supprimez les fichiers vous-même.',
    },
    source: 'https://daisydiskapp.com/',
    checkedOn: '2026-11-02',
  },
  {
    product: 'OnyX',
    plan: {},
    macs: 0,
    goodFor: {
      en: 'Maintenance scripts and hidden system settings, at no cost.',
      fr: 'Des scripts d’entretien et des réglages système cachés, sans frais.',
    },
    source: 'https://www.titanium-software.fr/en/onyx.html',
    checkedOn: '2026-11-03',
  },
  {
    product: 'AppCleaner',
    plan: {},
    macs: 0,
    goodFor: {
      en: 'Removing one app and its files at a time, at no cost.',
      fr: 'Supprimer une application et ses fichiers, une à la fois, sans frais.',
    },
    source: 'https://freemacsoft.net/appcleaner/',
    checkedOn: '2026-11-03',
  },
];

const money = (lang: Lang, n: number) => {
  const s = n.toFixed(2).replace(/\.00$/, '');
  return lang === 'fr' ? `${s.replace('.', ',')} $` : `$${s}`;
};

const words = {
  en: { perYear: '/yr', once: 'once', or: 'or', then: 'then', firstYear: 'first year', none: 'No cost', yearly: 'Yearly', oneTime: 'One-time', both: 'Yearly or one-time', any: 'Any' },
  fr: { perYear: '/an', once: 'une fois', or: 'ou', then: 'puis', firstYear: 'la 1re année', none: 'Sans frais', yearly: 'À l’année', oneTime: 'Une fois', both: 'À l’année ou une fois', any: 'Tous' },
} as const;

/** The price cell, e.g. "$39.95/yr or $85.95 once". */
export function priceText(lang: Lang, { once, yearly, firstYear }: Plan): string {
  const w = words[lang];
  const parts: string[] = [];
  if (yearly !== undefined) {
    parts.push(firstYear !== undefined
      ? `${money(lang, firstYear)} ${w.firstYear}, ${w.then} ${money(lang, yearly)}${w.perYear}`
      : `${money(lang, yearly)}${w.perYear}`);
  }
  if (once !== undefined) parts.push(`${money(lang, once)} ${w.once}`);
  return parts.length ? parts.join(` ${w.or} `) : w.none;
}

/** The billing cell. */
export function billingText(lang: Lang, { once, yearly }: Plan): string {
  const w = words[lang];
  if (once !== undefined && yearly !== undefined) return w.both;
  if (yearly !== undefined) return w.yearly;
  if (once !== undefined) return w.oneTime;
  return w.none;
}

/** The Macs cell; a free tool has no license limit. */
export const macsText = (lang: Lang, macs: number) => (macs === 0 ? words[lang].any : String(macs));

/** The 3-year cell. */
export const threeYearsText = (lang: Lang, plan: Plan) => money(lang, threeYears(plan));
