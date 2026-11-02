// The license key email (Decision 40; mac-cleaner Decisions 135, 136). Transactional: the key, how
// to activate it, what it covers, refunds, and who sent it. It is the product the buyer paid for,
// not a mailing, so it carries no unsubscribe link (Decision 4 covers the signup emails). It goes
// out in the buyer's language (Decision 5); the French ships as Claude drafted it (Decision 34).
// The app is in English, so its labels stay in English in the French copy (docs/french-glossary.md).

export type Lang = 'en' | 'fr';

export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const COPY = {
  en: {
    subject: 'Your CacheDrop license key',
    heading: 'Thank you for buying CacheDrop',
    intro: 'Here is your license key:',
    activate: 'To activate it, open CacheDrop, go to Settings → License, paste the key into the License key field and click Activate. It works offline.',
    covers: 'Your license covers up to 3 of your Macs and every CacheDrop 1.x release.',
    keep: 'Keep this email: it is your proof of purchase. If you lose the key, you can have it sent again from cachedrop.io.',
    refund: 'Changed your mind? Write to hello@cachedrop.io within 30 days for a full refund, no questions asked.',
    licenseId: 'License ID',
    privacy: 'Privacy policy',
    colon: ':',
  },
  // Quebec French: « courriel », and a non-breaking space before the colon.
  fr: {
    subject: 'Votre clé de licence CacheDrop',
    heading: 'Merci d’avoir acheté CacheDrop',
    intro: 'Voici votre clé de licence :',
    activate:
      'Pour l’activer, ouvrez CacheDrop, allez dans Settings → License, collez la clé dans le champ License key et cliquez sur Activate. Aucune connexion Internet n’est nécessaire.',
    covers: 'Votre licence couvre jusqu’à 3 de vos Mac et toutes les versions 1.x de CacheDrop.',
    keep: 'Gardez ce courriel : c’est votre preuve d’achat. Si vous perdez la clé, vous pouvez la recevoir de nouveau à partir de cachedrop.io.',
    refund: 'Vous avez changé d’avis? Écrivez à hello@cachedrop.io dans les 30 jours pour un remboursement complet, sans question.',
    licenseId: 'Numéro de licence',
    privacy: 'Politique de confidentialité',
    colon: ' :',
  },
} satisfies Record<Lang, Record<string, string>>;

/** The key email for `to`. `key` is the canonical 140-character key; `licenseId` its UUID. */
export function licenseEmail(to: string, lang: Lang, key: string, licenseId: string, siteUrl = 'https://cachedrop.io'): Email {
  const c = COPY[lang];
  const base = lang === 'fr' ? `${siteUrl}/fr` : siteUrl;
  const privacy = `${base}/privacy/`;
  // "cachedrop.io" in the keep line points at the resend page (#72, Decision 42).
  const resend = `${base}/resend-license-key/`;
  const [keepBefore, keepAfter] = c.keep.split(/cachedrop\.io(?=\.$)/);
  const text = [
    c.heading,
    '',
    c.intro,
    '',
    key,
    '',
    c.activate,
    '',
    c.covers,
    '',
    `${keepBefore}${resend}${keepAfter}`,
    '',
    c.refund,
    '',
    `${c.licenseId}${c.colon} ${licenseId}`,
    '',
    '—',
    'CacheDrop · hello@cachedrop.io · cachedrop.io',
    `${c.privacy}${c.colon} ${privacy}`,
  ].join('\n');

  // Plain markup with inline styles, as in src/server/download-email.ts. Light-mode tokens from
  // handoff/design-system/tokens.css: #1D1D1F --ink, #6E6E73 --ink-secondary, #FFFFFF --surface,
  // #E5E7EB --line, #0066CC --accent-text (the resend link). #F5F5F7 is --surface-subtle, behind the key. The app reads a key whatever
  // its line breaks, so letting it wrap is safe.
  const p = 'margin:0 0 16px;font-size:15px;line-height:23px;color:#1D1D1F';
  const small = 'margin:0 0 6px;font-size:12px;line-height:18px;color:#6E6E73';
  const html = `<!doctype html>
<html lang="${lang}">
<body style="margin:0;padding:32px 16px;background:#FFFFFF;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif">
<div style="max-width:520px;margin:0 auto">
<p style="${p};font-size:18px;line-height:24px;font-weight:600">${c.heading}</p>
<p style="${p}">${c.intro}</p>
<p style="${p};padding:12px 14px;border-radius:8px;background:#F5F5F7;font-family:ui-monospace,Menlo,monospace;font-size:13px;line-height:20px;word-break:break-all">${key}</p>
<p style="${p}">${c.activate}</p>
<p style="${p}">${c.covers}</p>
<p style="${p}">${keepBefore}<a href="${resend}" style="color:#0066CC">cachedrop.io</a>${keepAfter}</p>
<p style="${p};color:#6E6E73">${c.refund}</p>
<p style="${p};color:#6E6E73">${c.licenseId}${c.colon} ${licenseId}</p>
<hr style="margin:24px 0 16px;border:0;border-top:1px solid #E5E7EB">
<p style="${small}">CacheDrop · <a href="mailto:hello@cachedrop.io" style="color:#6E6E73">hello@cachedrop.io</a> · cachedrop.io</p>
<p style="${small}"><a href="${privacy}" style="color:#6E6E73">${c.privacy}</a></p>
</div>
</body>
</html>`;

  return { to, subject: c.subject, text, html };
}
