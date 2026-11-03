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

/**
 * Whether the pricing section links to the compare page (#87) in each language. It stays off until
 * that page is built and indexed in the language, so the link never leads to a 404 or a draft;
 * tests/pricing.spec.ts fails if this disagrees with the build either way.
 */
export const compareLive: Readonly<Record<Lang, boolean>> = { en: false, fr: false };

/** Whether the limited-time offer is running. */
export const discounted = price.offer !== price.regular;

const en = (n: string) => `$${n}`;
const fr = (n: string) => `${n.replace('.', ',')}\u00a0$`;

//   is a non-breaking space: before the French colon and currency symbol, and between a
// number and its unit (docs/french-glossary.md).
export const pricingCopy = {
  en: {
    eyebrow: 'Pricing',
    // The trial, stated once under the primary button of the homepage and every guide (Decision 51).
    trial: 'Try it before you buy · No card needed · macOS 14 or later',
    // Outcomes first, then the price (Decision 51, #113).
    title: 'Pay once. Use it on 3 Macs.',
    body: 'See what’s filling your Mac, clean it up safely, and remove apps and plug-ins completely. You check everything first, and your files go to the Trash, so nothing is lost by mistake.',
    name: 'CacheDrop license',
    was: en(price.regular),
    now: en(price.offer),
    spoken: `Was ${en(price.regular)}, now ${en(price.offer)} for a limited time, one-time.`,
    limited: 'Limited-time price',
    once: 'one-time',
    currencies: 'Pay in USD, CAD, EUR, GBP or AUD: the same number in each.',
    included: 'What’s included',
    items: [
      'Use it on up to 3 of your Macs.',
      'Every update through version 1, ready for each new macOS when it ships.',
      'No subscription. Nothing to cancel.',
      '30-day refunds, no questions asked.',
      'Scanning is always free, and you can clean up to 2 GB before you buy.',
    ],
    // Shown only while the compare page (#87) is built and indexed in this language (`compareLive`).
    compare: 'Compare CacheDrop with other Mac cleaners',
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
    trial: 'Essayez-le avant d’acheter · Aucune carte requise · macOS 14 ou version ultérieure',
    title: 'Payez une seule fois. Utilisez-le sur 3 Mac.',
    body: 'Voyez ce qui remplit votre Mac, nettoyez-le en toute sécurité et désinstallez complètement applications et plug-ins. Vous vérifiez tout avant, et vos fichiers vont dans la Corbeille, donc rien n’est perdu par erreur.',
    name: 'Licence CacheDrop',
    was: fr(price.regular),
    now: fr(price.offer),
    spoken: `Prix régulier ${fr(price.regular)}, maintenant ${fr(price.offer)} pour un temps limité, une seule fois.`,
    limited: 'Prix pour un temps limité',
    once: 'une seule fois',
    currencies: 'Payez en USD, CAD, EUR, GBP ou AUD : le même montant dans chaque devise.',
    included: 'Ce qui est inclus',
    items: [
      'Utilisez-le sur un maximum de 3 de vos Mac.',
      'Toutes les mises à jour de la version 1, prêtes pour chaque nouvelle version de macOS dès sa sortie.',
      'Aucun abonnement. Rien à annuler.',
      'Remboursement dans les 30 jours, sans avoir à vous justifier.',
      'L’analyse est toujours gratuite, et vous pouvez nettoyer jusqu’à 2 Go avant d’acheter.',
    ],
    compare: 'Comparer CacheDrop aux autres nettoyeurs pour Mac',
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
