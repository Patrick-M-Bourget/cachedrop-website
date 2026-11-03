// The price and the pricing section's copy (Decisions 44 and 47). Pricing is always on: the
// launch setting that once hid it retired with Decision 52.
import type { Lang } from '../i18n';

/** Where a page in `lang` sends its Buy links (Decision 41). */
export const buyHref = (lang: Lang) => (lang === 'fr' ? '/buy?lang=fr' : '/buy');

/**
 * The price in each currency's number (Decision 47, amends 44): the regular price is 29.99 and 19.99
 * is a limited-time offer. Copy never calls it a launch price (the Stripe code stays LAUNCH). Every page reads these; ending the offer
 * means setting `offer` to `regular` here and the matching Stripe change, and nothing else in the copy.
 * The terms of sale state both numbers in their own legal wording and are checked by legal.spec.ts.
 */
export const price: { readonly regular: string; readonly offer: string } = { regular: '29.99', offer: '19.99' };

/** Whether the limited-time offer is running. */
export const discounted = price.offer !== price.regular;

const en = (n: string) => `$${n}`;
const fr = (n: string) => `${n.replace('.', ',')}\u00a0$`;

//   is a non-breaking space: before the French colon and currency symbol, and between a
// number and its unit (docs/french-glossary.md).
export const pricingCopy = {
  en: {
    eyebrow: 'Pricing',
    title: 'Try it before you buy. Pay once.',
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
    // The Buy button (Decision 51): "Buy · $29.99 once", with the offer shown as on the card (Decision 47).
    buy: 'Buy',
    buyOnce: 'once',
    wasWord: 'was',
    nowWord: 'now',
    download: 'Download for Mac',
    // Odd entries are the links to the terms of sale, refund policy and license agreement, in order.
    // Prose for meta descriptions and answers: the regular price, then the discount while it runs.
    license: discounted ? `${en(price.regular)} once, now ${en(price.offer)} for a limited time` : `${en(price.regular)} once`,
    legal: ['Read the ', 'terms of sale', ', the ', 'refund policy', ' and the ', 'license agreement', '.'],
  },
  fr: {
    eyebrow: 'Tarifs',
    title: 'Essayez-le avant d’acheter. Payez une seule fois.',
    body: 'L’analyse est toujours gratuite, et vous pouvez nettoyer jusqu’à 2 Go avant d’acheter. Une licence vous donne toutes les versions 1.x.',
    name: 'Licence CacheDrop',
    was: fr(price.regular),
    now: fr(price.offer),
    spoken: `Prix régulier ${fr(price.regular)}, maintenant ${fr(price.offer)} pour un temps limité, une seule fois.`,
    limited: 'Prix pour un temps limité',
    once: 'une seule fois',
    currencies: 'Payez en USD, CAD, EUR, GBP ou AUD : le même montant dans chaque devise.',
    included: 'Ce qui est inclus',
    items: [
      'Nettoyage gratuit jusqu’à 2 Go, et l’analyse est toujours gratuite',
      'Sur un maximum de 3 de vos Mac',
      'Toutes les versions 1.x',
      'Remboursement dans les 30 jours, sans avoir à vous justifier',
    ],
    buy: 'Acheter',
    // No « une seule fois » on the button: it wraps at 390 px, and the price above already says it (owner, #107).
    buyOnce: '',
    wasWord: 'prix régulier',
    nowWord: 'maintenant',
    download: 'Télécharger pour Mac',
    license: discounted ? `${fr(price.regular)} une seule fois, maintenant ${fr(price.offer)} pour un temps limité` : `${fr(price.regular)} une seule fois`,
    legal: ['Consultez les ', 'conditions de vente', ', la ', 'politique de remboursement', ' et le ', 'contrat de licence', '.'],
  },
} satisfies Record<Lang, Record<string, string | string[]>>;
