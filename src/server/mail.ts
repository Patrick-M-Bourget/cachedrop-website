// Sending email through Resend's REST API (Decision 14), and the capture mode previews use so
// Playwright can read the download link (Decision 27). Production never captures.
import type { Email } from './gate.ts';

export const FROM = 'CacheDrop <hello@cachedrop.io>';
/** A signup request with this header gets the email back instead of it being sent, on a capturing preview. */
export const CAPTURE_HEADER = 'x-capture-email';

type Env = Record<string, string | undefined>;

/** The mail sender for one signup request. */
export function mailerFor(request: Request, env: Env, fetch: typeof globalThis.fetch): (email: Email) => Promise<Email | void> {
  const capture = env.CAPTURE_EMAIL === '1' && env.VERCEL_ENV !== 'production' && request.headers.get(CAPTURE_HEADER) === '1';
  if (capture) return async (email) => email;

  return async (email) => {
    if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set');
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [email.to], subject: email.subject, text: email.text, html: email.html, headers: email.headers }),
    });
    if (!res.ok) throw new Error(`Resend answered ${res.status}`);
  };
}

/** The origin emailed links point at: the production domain, or this preview's branch URL. */
export function siteUrlFrom(env: Env): string {
  const host =
    env.VERCEL_ENV === 'production'
      ? env.VERCEL_PROJECT_PRODUCTION_URL
      : env.VERCEL_ENV === 'preview'
        ? (env.VERCEL_BRANCH_URL ?? env.VERCEL_URL)
        : undefined;
  return host ? `https://${host}` : 'https://cachedrop.io';
}
