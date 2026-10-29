// Unsubscribe (Decision 4): every email carries one link, plus the RFC 8058 one-click headers,
// that turn off update emails and the news opt-in for that address. No preferences page, no
// sign-in. Each email gets its own token, stored as a SHA-256 hash like download tokens, and it
// never expires (CASL wants at least 60 days).
//
// Two URLs, one handler:
// - The link in the email opens /unsubscribe/<token>/ (rewritten to src/pages/unsubscribe/ by
//   vercel.json). That page POSTs the token here and says in one sentence that it worked.
// - List-Unsubscribe points at /api/unsubscribe?token=. Mail clients POST
//   `List-Unsubscribe=One-Click` to it (RFC 8058 §3.2) and get an empty 200, never a redirect
//   (§3.1). A GET changes nothing and sends the browser to the page, so a link scanner that
//   prefetches URLs can't unsubscribe anyone.
// A French email's links carry its language (Decision 5): the page is /fr/unsubscribe/<token>/,
// and List-Unsubscribe adds &lang=fr so a GET lands on the French page.
import { pagesFor } from './download-email.js';
import type { GateDb, Lang } from './gate.ts';
import { TOKEN, hashToken } from './tokens.js';

export const ONE_CLICK = 'List-Unsubscribe=One-Click';

/** The emailed page link, and the headers that make the mail client's one-click button work. */
export function unsubscribeFor(siteUrl: string, token: string, lang: Lang) {
  const api = `${siteUrl}/api/unsubscribe?token=${token}${lang === 'fr' ? '&lang=fr' : ''}`;
  return {
    link: `${pagesFor(siteUrl, lang)}/unsubscribe/${token}/`,
    headers: { 'List-Unsubscribe': `<${api}>`, 'List-Unsubscribe-Post': ONE_CLICK },
  };
}

/** GET or POST /api/unsubscribe?token=. Unsubscribing twice is harmless: both answer 200. */
export async function handleUnsubscribe(request: Request, deps: { db: GateDb }): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const token = params.get('token') ?? '';
  const valid = TOKEN.test(token);
  if (request.method !== 'POST') {
    const page = `${pagesFor('', params.get('lang') === 'fr' ? 'fr' : 'en')}/unsubscribe/${valid ? `${token}/` : ''}`;
    return new Response(null, { status: 303, headers: { location: page, 'cache-control': 'no-store' } });
  }
  const empty = (status: number) => new Response(null, { status, headers: { 'cache-control': 'no-store' } });
  if (!valid) return empty(404);
  const { data, error } = await deps.db.rpc('unsubscribe', { p_token_hash: hashToken(token) });
  if (error) return empty(503);
  return empty(data ? 200 : 404);
}
