// The download email (Decisions 2, 3). Transactional: the link, what CacheDrop is, who sent it and
// the privacy policy. Nothing promotional. The mailing address joins the sender line once the PO
// box exists (Decision 21, launch-blocking). The unsubscribe link and headers come with #10.
import type { Email } from './gate.ts';

export function downloadEmail(to: string, link: string, siteUrl: string): Email {
  const privacy = `${siteUrl}/privacy/`;
  const text = [
    'Here is your CacheDrop download link:',
    '',
    link,
    '',
    'It works for 7 days, on any Mac.',
    '',
    'CacheDrop is a Mac storage cleaner made for developers and video editors. It is free while in beta.',
    '',
    'You asked for this link on cachedrop.io. If that wasn’t you, ignore this email.',
    '',
    '—',
    'CacheDrop · hello@cachedrop.io · cachedrop.io',
    `Privacy policy: ${privacy}`,
  ].join('\n');

  // Plain markup with inline styles, which is what mail clients render reliably.
  const p = 'margin:0 0 16px;font-size:15px;line-height:23px;color:#1D1D1F';
  const small = 'margin:0 0 6px;font-size:12px;line-height:18px;color:#6E6E73';
  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:32px 16px;background:#FFFFFF;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif">
<div style="max-width:520px;margin:0 auto">
<p style="${p};font-size:18px;line-height:24px;font-weight:600">Here is your CacheDrop download link</p>
<p style="${p}"><a href="${link}" style="display:inline-block;padding:12px 20px;border-radius:9999px;background:#0071E3;color:#FFFFFF;font-weight:500;text-decoration:none">Download CacheDrop</a></p>
<p style="${p}">It works for 7 days, on any Mac. If the button doesn’t work, paste this link into your browser:<br><a href="${link}" style="color:#0066CC;word-break:break-all">${link}</a></p>
<p style="${p}">CacheDrop is a Mac storage cleaner made for developers and video editors. It is free while in beta.</p>
<p style="${p};color:#6E6E73">You asked for this link on cachedrop.io. If that wasn’t you, ignore this email.</p>
<hr style="margin:24px 0 16px;border:0;border-top:1px solid #E5E7EB">
<p style="${small}">CacheDrop · <a href="mailto:hello@cachedrop.io" style="color:#6E6E73">hello@cachedrop.io</a> · cachedrop.io</p>
<p style="${small}"><a href="${privacy}" style="color:#6E6E73">Privacy policy</a></p>
</div>
</body>
</html>`;

  return { to, subject: 'Your CacheDrop download link', text, html };
}
