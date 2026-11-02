// The license Edge Function's two requests (Decision 40): Stripe's webhook, which issues and emails
// a key after each purchase, and "resend my key". Supabase, Resend, Turnstile and the key come in as
// dependencies, so Vitest stands in for them at the boundary (Decision 27); index.ts wires in the
// real ones. Web Crypto and fetch only, so the same file runs in Deno and in Node.
import { licenseEmail, type Email, type Lang } from './email.ts';
import { issueDay, signLicenseKey } from './key.ts';
import { verifyStripeSignature } from './stripe-signature.ts';

/** What a PostgREST rpc call resolves to (the shape supabase-js uses too). */
export type Result<T> = Promise<{ data: T | null; error: { message: string } | null }>;

export interface LicenseRow {
  id: string;
  edition: 'standard';
  macs: number;
  issue_day: number;
  email: string;
  lang: Lang;
  emailed_at: string | null;
}

/** The SQL functions supabase/migrations/*_licenses.sql and *_rate_limits.sql add. */
export interface LicenseDb {
  rpc(
    fn: 'issue_license',
    args: {
      p_id: string;
      p_stripe_session_id: string;
      p_stripe_customer_id: string | null;
      p_email: string;
      p_lang: Lang;
      p_edition: 'standard';
      p_macs: number;
      p_issue_day: number;
    },
  ): Result<LicenseRow[]>;
  rpc(fn: 'mark_license_emailed', args: { p_id: string }): Result<boolean>;
  rpc(fn: 'licenses_for_email', args: { p_email: string }): Result<LicenseRow[]>;
  rpc(fn: 'hit_rate_limit', args: { p_bucket: 'license'; p_ip_hash: string; p_limit: number; p_window_seconds: number }): Result<number>;
}

/** Sends one email; resolves once Resend has accepted it. Same key, same email within 24 hours. */
export type Send = (email: Email, idempotencyKey?: string) => Promise<void>;

/** Every license is the same (mac-cleaner Decision 135): standard, up to 3 Macs, at 19.99 or 29.99. */
export const EDITION = 'standard';
export const MACS = 3;
/** "Resend my key" per place, like the download form (src/server/bot-check.ts LIMITS.signup). */
export const RESEND_LIMIT = { limit: 5, windowSeconds: 60 * 60 };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SESSION = /^cs_(test|live)_[A-Za-z0-9]+$/;
const CUSTOMER = /^cus_[A-Za-z0-9]+$/;
/** The Checkout events that can complete a payment: at once, or later for delayed methods. */
const PAID_EVENTS = ['checkout.session.completed', 'checkout.session.async_payment_succeeded'];

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });

export interface WebhookDeps {
  db: LicenseDb;
  send: Send;
  /** The Ed25519 signing key, imported from the LICENSE_PRIVATE_KEY secret. */
  privateKey: () => Promise<CryptoKey>;
  /** The endpoint's signing secret (whsec_…). */
  webhookSecret: string;
  now: () => Date;
  /** A random UUID for a new license. */
  newId: () => string;
}

interface CheckoutSession {
  id?: unknown;
  mode?: unknown;
  payment_status?: unknown;
  locale?: unknown;
  metadata?: { lang?: unknown } | null;
  customer?: unknown;
  customer_email?: unknown;
  customer_details?: { email?: unknown } | null;
}

/**
 * The buyer's language: French when Checkout ran in French or the Payment Link's metadata says
 * `lang: fr`, English otherwise.
 */
export function sessionLang(session: CheckoutSession): Lang {
  if (typeof session.locale === 'string' && session.locale.toLowerCase().startsWith('fr')) return 'fr';
  return session.metadata?.lang === 'fr' ? 'fr' : 'en';
}

/** Signs the key from a stored row and emails it. Throws when Resend doesn't accept it. */
async function emailKey(row: LicenseRow, lang: Lang, deps: Pick<WebhookDeps, 'send' | 'privateKey'>, idempotencyKey?: string) {
  const key = await signLicenseKey(await deps.privateKey(), { id: row.id, macs: row.macs, issueDay: row.issue_day });
  await deps.send(licenseEmail(row.email, lang, key, row.id), idempotencyKey);
}

/**
 * POST from Stripe. Answers 400 to anything without a valid Stripe-Signature, 2xx to events it
 * doesn't act on, and 2xx to a paid Checkout Session only after its license is stored and Resend has
 * accepted the key email, so Stripe retries anything that failed. A replay of a session whose email
 * went out issues and sends nothing.
 */
export async function handleStripeWebhook(request: Request, deps: WebhookDeps): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, { allow: 'POST' });
  if (!deps.webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set');
    return json({ error: 'unavailable' }, 503);
  }
  const body = await request.text();
  const nowSeconds = Math.floor(deps.now().getTime() / 1000);
  if (!(await verifyStripeSignature(body, request.headers.get('stripe-signature'), deps.webhookSecret, nowSeconds))) {
    return json({ error: 'bad_signature' }, 400);
  }

  let event: { type?: unknown; data?: { object?: CheckoutSession } };
  try {
    event = JSON.parse(body);
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  if (typeof event.type !== 'string' || !PAID_EVENTS.includes(event.type)) return json({ ignored: true });
  const session = event.data?.object ?? {};
  // A delayed payment completes the session unpaid; its async_payment_succeeded event issues the key.
  if (session.mode !== 'payment' || session.payment_status !== 'paid') return json({ ignored: true });

  const sessionId = typeof session.id === 'string' && SESSION.test(session.id) ? session.id : null;
  const rawEmail = session.customer_details?.email ?? session.customer_email;
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
  if (!sessionId || email.length > 254 || !EMAIL.test(email)) {
    // Retrying can't fix it; the error keeps it in Stripe's failed deliveries for the owner.
    console.error('paid Checkout Session without a usable session ID or email');
    return json({ error: 'unusable_session' }, 422);
  }
  const customer = typeof session.customer === 'string' && CUSTOMER.test(session.customer) ? session.customer : null;
  const lang = sessionLang(session);

  const issued = await deps.db.rpc('issue_license', {
    p_id: deps.newId(),
    p_stripe_session_id: sessionId,
    p_stripe_customer_id: customer,
    p_email: email,
    p_lang: lang,
    p_edition: EDITION,
    p_macs: MACS,
    p_issue_day: issueDay(deps.now()),
  });
  const row = issued.data?.[0];
  if (issued.error || !row) {
    // The message names the call and its status (services.ts), never a secret (#76).
    console.error('issue_license failed:', issued.error?.message ?? 'no row');
    return json({ error: 'unavailable' }, 503);
  }
  if (row.emailed_at) return json({ ok: true, repeat: true });

  try {
    // Resend drops a second send with the same key within 24 hours, so a retry after the email went
    // out but before it was marked doesn't send it twice.
    await emailKey(row, row.lang, deps, `license-${row.id}`);
  } catch (e) {
    console.error('license email failed:', (e as Error).message);
    return json({ error: 'email_failed' }, 502);
  }
  const marked = await deps.db.rpc('mark_license_emailed', { p_id: row.id });
  if (marked.error || marked.data !== true) {
    console.error('mark_license_emailed failed:', marked.error?.message ?? 'no license');
    return json({ error: 'unavailable' }, 503);
  }
  return json({ ok: true });
}

export type Verdict = 'ok' | 'failed' | 'unavailable';

export interface ResendDeps {
  db: LicenseDb;
  send: Send;
  privateKey: () => Promise<CryptoKey>;
  /** Cloudflare Turnstile's siteverify for one token. */
  verify: (token: string, ip: string | null) => Promise<Verdict>;
  /** The client IP, passed on to Turnstile. Never stored. */
  ip: string | null;
  /** The keyed hash the request is counted under (rate-limit.ts). */
  rateKey: string;
}

/**
 * POST with JSON `{ email, lang?, turnstile }`: emails every license bought with that address
 * again, in `lang` ("en" unless exactly "fr"). The bot check and the per-place limit run first, as
 * on the download form (Decision 12). The answer is the same whether or not the address bought
 * anything, so it doesn't tell who is a customer.
 */
export async function handleResend(request: Request, deps: ResendDeps): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, { allow: 'POST' });
  let body: { email?: unknown; lang?: unknown; turnstile?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (email.length > 254 || !EMAIL.test(email)) return json({ error: 'invalid_email' }, 400);
  const lang: Lang = body.lang === 'fr' ? 'fr' : 'en';

  const token = body.turnstile;
  if (typeof token !== 'string' || !token || token.length > 2048) return json({ error: 'bot_check' }, 403);
  const verdict = await deps.verify(token, deps.ip);
  if (verdict === 'failed') return json({ error: 'bot_check' }, 403);
  if (verdict === 'unavailable') return json({ error: 'unavailable' }, 503);
  const hit = await deps.db.rpc('hit_rate_limit', {
    p_bucket: 'license',
    p_ip_hash: deps.rateKey,
    p_limit: RESEND_LIMIT.limit,
    p_window_seconds: RESEND_LIMIT.windowSeconds,
  });
  if (hit.error || typeof hit.data !== 'number') {
    console.error('hit_rate_limit failed:', hit.error?.message ?? 'no count');
    return json({ error: 'unavailable' }, 503);
  }
  if (hit.data > 0) return json({ error: 'rate_limited', retryAfter: hit.data }, 429, { 'retry-after': String(hit.data) });

  const found = await deps.db.rpc('licenses_for_email', { p_email: email });
  if (found.error || !found.data) {
    console.error('licenses_for_email failed:', found.error?.message ?? 'no rows');
    return json({ error: 'unavailable' }, 503);
  }
  try {
    for (const row of found.data) await emailKey(row, lang, deps);
  } catch (e) {
    console.error('license resend failed:', (e as Error).message);
    return json({ error: 'email_failed' }, 502);
  }
  return json({ ok: true });
}
