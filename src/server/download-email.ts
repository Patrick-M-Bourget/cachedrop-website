// The download email (Decisions 2, 3). Transactional: the link, what CacheDrop is, who sent it and
// the privacy policy. Nothing promotional. No mailing address for the beta (Decision 33).
// Like every email, it carries the unsubscribe link and one-click headers (Decision 4). It goes out
// in the language the person signed up in (Decision 5); the French ships as Claude drafted it
// (Decision 34).
import type { Email } from './gate.ts';
import type { Lang } from '../i18n.ts';

const COPY = {
  en: {
    subject: 'Your CacheDrop download link',
    heading: 'Here is your CacheDrop download link',
    intro: 'Here is your CacheDrop download link:',
    button: 'Download CacheDrop',
    validity: 'The link works for 7 days, on any Mac. CacheDrop itself doesn’t expire.',
    fallback: 'If the button doesn’t work, paste this link into your browser:',
    about: 'CacheDrop is a Mac storage cleaner made for developers and video editors. It is free while in beta.',
    notYou: 'You asked for this link on cachedrop.io. If that wasn’t you, ignore this email.',
    privacy: 'Privacy policy',
    unsubscribe: 'Unsubscribe',
    colon: ':',
  },
  // Quebec French: « courriel », and a non-breaking space before the colon.
  fr: {
    subject: 'Votre lien de téléchargement CacheDrop',
    heading: 'Voici votre lien de téléchargement CacheDrop',
    intro: 'Voici votre lien de téléchargement CacheDrop :',
    button: 'Télécharger CacheDrop',
    validity: 'Le lien fonctionne pendant 7 jours, sur n’importe quel Mac. CacheDrop lui-même n’expire pas.',
    fallback: 'Si le bouton ne fonctionne pas, collez ce lien dans votre navigateur :',
    about:
      'CacheDrop est un nettoyeur de stockage pour Mac conçu pour les développeurs et les monteurs vidéo. Il est gratuit pendant la bêta.',
    notYou: 'Vous avez demandé ce lien sur cachedrop.io. Si ce n’était pas vous, ignorez ce courriel.',
    privacy: 'Politique de confidentialité',
    unsubscribe: 'Se désabonner',
    colon: ' :',
  },
} satisfies Record<Lang, Record<string, string>>;

/** The site's pages in this language: https://cachedrop.io or https://cachedrop.io/fr. */
export const pagesFor = (siteUrl: string, lang: Lang) => (lang === 'fr' ? `${siteUrl}/fr` : siteUrl);

export function downloadEmail(
  to: string,
  lang: Lang,
  link: string,
  siteUrl: string,
  unsubscribe: { link: string; headers: Record<string, string> },
): Email {
  const c = COPY[lang];
  const privacy = `${pagesFor(siteUrl, lang)}/privacy/`;
  const text = [
    c.intro,
    '',
    link,
    '',
    c.validity,
    '',
    c.about,
    '',
    c.notYou,
    '',
    '—',
    'CacheDrop · hello@cachedrop.io · cachedrop.io',
    `${c.privacy}${c.colon} ${privacy}`,
    `${c.unsubscribe}${c.colon} ${unsubscribe.link}`,
  ].join('\n');

  // Plain markup with inline styles, which is what mail clients render reliably. Email can't use
  // CSS variables, so each colour is a light-mode token from handoff/design-system/tokens.css:
  //   #1D1D1F --ink               #6E6E73 --ink-secondary   #FFFFFF --surface, --on-accent (button text)
  //   #0071E3 --accent (button)   #0066CC --accent-text     #E5E7EB --line (the rule)
  const p = 'margin:0 0 16px;font-size:15px;line-height:23px;color:#1D1D1F';
  const small = 'margin:0 0 6px;font-size:12px;line-height:18px;color:#6E6E73';
  const html = `<!doctype html>
<html lang="${lang}">
<body style="margin:0;padding:32px 16px;background:#FFFFFF;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif">
<div style="max-width:520px;margin:0 auto">
<p style="${p};font-size:18px;line-height:24px;font-weight:600">${c.heading}</p>
<p style="${p}"><a href="${link}" style="display:inline-block;padding:12px 20px;border-radius:9999px;background:#0071E3;color:#FFFFFF;font-weight:500;text-decoration:none">${c.button}</a></p>
<p style="${p}">${c.validity}</p>
<p style="${p}">${c.fallback}<br><a href="${link}" style="color:#0066CC;word-break:break-all">${link}</a></p>
<p style="${p}">${c.about}</p>
<p style="${p};color:#6E6E73">${c.notYou}</p>
<hr style="margin:24px 0 16px;border:0;border-top:1px solid #E5E7EB">
<p style="${small}">CacheDrop · <a href="mailto:hello@cachedrop.io" style="color:#6E6E73">hello@cachedrop.io</a> · cachedrop.io</p>
<p style="${small}"><a href="${privacy}" style="color:#6E6E73">${c.privacy}</a> · <a href="${unsubscribe.link}" style="color:#6E6E73">${c.unsubscribe}</a></p>
</div>
</body>
</html>`;

  return { to, subject: c.subject, text, html, headers: unsubscribe.headers };
}
