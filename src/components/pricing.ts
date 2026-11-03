// The launch setting (Decision 44): PUBLIC_PRICING_LIVE=1 at build time shows pricing, the Buy
// links and the "Download free" copy; anything else, or unset, builds the site as it was. Vercel
// reads it at build time, so flipping it takes a redeploy. The download email's server code reads
// the same variable at run time (src/server/vercel.ts).
import type { Lang } from '../i18n';

/** Whether `value` (the variable as read from the environment) turns pricing on. */
export const isPricingLive = (value: string | undefined) => value === '1';

/** This build's setting. */
export const pricingLive = isPricingLive(import.meta.env.PUBLIC_PRICING_LIVE);

/** Where a page in `lang` sends its Buy links (Decision 41). */
export const buyHref = (lang: Lang) => (lang === 'fr' ? '/buy?lang=fr' : '/buy');

/**
 * The price in each currency's number (Decision 47, amends 44): the regular price is 29.99 and 19.99
 * is a limited-time offer. Copy never calls it a launch price. Every page reads these; ending the offer
 * means setting `offer` to `regular` here and the matching Stripe change, and nothing else in the copy.
 * The terms of sale state both numbers in their own legal wording and are checked by legal.spec.ts.
 */
export const price: { readonly regular: string; readonly offer: string } = { regular: '29.99', offer: '19.99' };

/** Whether the limited-time offer is running. */
export const discounted = price.offer !== price.regular;

const en = (n: string) => `$${n}`;
const fr = (n: string) => `${n.replace('.', ',')}\u00a0$`;

/** Picks a page's copy: the base strings, with the launch strings over them when pricing is live. */
export const withLaunch = <T extends object>(base: T, launch: Partial<T>, live = pricingLive): T => (live ? { ...base, ...launch } : base);

//   is a non-breaking space: before the French colon and currency symbol, and between a
// number and its unit (docs/french-glossary.md).
export const pricingCopy = {
  en: {
    eyebrow: 'Pricing',
    title: 'Try it free. Pay once.',
    body: 'Scanning is always free, and you can clean up to 2 GB before you buy. One license covers every 1.x release.',
    name: 'CacheDrop license',
    was: en(price.regular),
    now: en(price.offer),
    spoken: `Was ${en(price.regular)}, now ${en(price.offer)} for a limited time, one-time.`,
    limited: 'Limited-time price',
    once: 'one-time',
    currencies: 'Pay in USD, CAD, EUR, GBP or AUD: the same number in each.',
    included: 'What’s included',
    items: [
      'Free cleanup up to 2 GB, and scanning is always free',
      'Use it on up to 3 of your Macs',
      'Every 1.x release',
      '30-day refunds, no questions asked',
    ],
    buy: 'Buy a License',
    download: 'Download Free',
    // Odd entries are the links to the terms of sale, refund policy and license agreement, in order.
    // Prose for meta descriptions and answers: the regular price, then the discount while it runs.
    license: discounted ? `${en(price.regular)} once, now ${en(price.offer)} for a limited time` : `${en(price.regular)} once`,
    legal: ['Read the ', 'terms of sale', ', the ', 'refund policy', ' and the ', 'license agreement', '.'],
  },
  fr: {
    eyebrow: 'Tarifs',
    title: 'Essayez-le gratuitement. Payez une seule fois.',
    body: 'L’analyse est toujours gratuite, et vous pouvez nettoyer jusqu’à 2 Go avant d’acheter. Une licence vous donne toutes les versions 1.x.',
    name: 'Licence CacheDrop',
    was: '29,99 $',
    now: '19,99 $',
    spoken: 'Prix régulier 29,99 $, maintenant 19,99 $, une seule fois.',
    once: 'une seule fois',
    currencies: 'Payez en USD, CAD, EUR, GBP ou AUD : le même montant dans chaque devise.',
    included: 'Ce qui est inclus',
    items: [
      'Nettoyage gratuit jusqu’à 2 Go, et l’analyse est toujours gratuite',
      'Sur un maximum de 3 de vos Mac',
      'Toutes les versions 1.x',
      'Remboursement dans les 30 jours, sans avoir à vous justifier',
    ],
    buy: 'Acheter une licence',
    download: 'Télécharger gratuitement',
    license: discounted ? `${fr(price.regular)} une seule fois, maintenant ${fr(price.offer)} pour un temps limité` : `${fr(price.regular)} une seule fois`,
    legal: ['Consultez les ', 'conditions de vente', ', la ', 'politique de remboursement', ' et le ', 'contrat de licence', '.'],
  },
} satisfies Record<Lang, Record<string, string | string[]>>;
