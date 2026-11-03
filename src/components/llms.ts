// /llms.txt (#94, Decision 51): a short plain-text map of the site for AI answer engines, in the
// llmstxt.org format. Every line is built from the copy the pages show (the footer, the pricing
// section and each guide's title and description), so it can't disagree with them.
import { footerCopy } from './footer';
import { guides } from './guides';
import { pricingCopy } from './pricing';
import { localize, type Lang } from '../i18n';

const guideKeys = ['developer', 'creator', 'producer', 'systemData', 'apps'] as const;

/** The file's text, with absolute links on `site` (e.g. `https://cachedrop.io`). */
export function llmsTxt(site: string): string {
  const en = footerCopy.en;
  const p = pricingCopy.en;
  const link = (lang: Lang, path: string) => `${site}${localize(lang, path)}`;
  const guideLines = (lang: Lang) =>
    guideKeys.map((key) => `- [${footerCopy[lang][key]}](${link(lang, guides[key].path)}): ${guides[key][lang].description}`);
  return [
    '# CacheDrop',
    '',
    `> ${en.tagline}`,
    '',
    `## ${p.eyebrow}`,
    '',
    `- A license is ${p.license}, for up to 3 Macs.`,
    ...p.items.map((item) => `- ${item}`),
    `- ${p.currencies}`,
    `- [${p.eyebrow}](${link('en', '/pricing/')})`,
    `- [${p.buy}](${site}/buy)`,
    '',
    `## ${en.platform}`,
    '',
    `- ${en.chips}`,
    `- ${en.macos}`,
    `- [${en.download}](${link('en', '/download/')})`,
    '',
    `## ${en.guides}`,
    '',
    ...guideLines('en'),
    '',
    '## Policies',
    '',
    ...(['privacy', 'terms', 'refunds', 'license'] as const).map((key, i) =>
      `- [${en[key]}](${link('en', ['/privacy/', '/terms-of-sale/', '/refund-policy/', '/license-agreement/'][i])})`),
    '',
    '## Français',
    '',
    `- [CacheDrop](${link('fr', '/')}): ${footerCopy.fr.tagline}`,
    ...guideLines('fr'),
    '',
  ].join('\n');
}
