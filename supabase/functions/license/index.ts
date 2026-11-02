// The license Supabase Edge Function (Decision 40; cachedrop-website#64). Deployed with JWT
// verification off, since Stripe can't send a Supabase token; the Stripe signature and Turnstile are
// the checks, and LICENSE_ADMIN_SECRET for the owner's route. Three routes:
//   POST /functions/v1/license/stripe-webhook  Stripe's checkout.session.* events (handlers.ts)
//   POST /functions/v1/license/resend          "resend my key": { email, lang?, turnstile }
//   POST /functions/v1/license/comp            a free license (Decision 45): { id, email, lang?, note? }
// Secrets come only from the environment (supabase secrets set; docs/licensing.md); none is logged.
// The logic lives in Web Crypto/fetch modules that Vitest tests too; this file only wires them up.
import { handleComp, handleResend, handleStripeWebhook, json } from './handlers.ts';
import { importPrivateKey } from './key.ts';
import { clientIp, corsHeaders, dbKey, ipHash, resendSender, restDb, turnstile } from './services.ts';

interface DenoRuntime {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): unknown;
}
const { Deno } = globalThis as unknown as { Deno: DenoRuntime };
const env = (name: string) => Deno.env.get(name) ?? '';

let privateKey: Promise<CryptoKey> | null = null;
/** Imported once per instance; a bad secret throws on use and the request answers an error. */
const signingKey = () => (privateKey ??= importPrivateKey(env('LICENSE_PRIVATE_KEY')).catch((e) => {
  privateKey = null;
  throw e;
}));

const db = () => restDb(env('SUPABASE_URL'), dbKey(env));

async function route(request: Request): Promise<Response> {
  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  if (path.endsWith('/stripe-webhook')) {
    return handleStripeWebhook(request, {
      db: db(),
      send: resendSender(env('RESEND_API_KEY')),
      privateKey: signingKey,
      webhookSecret: env('STRIPE_WEBHOOK_SECRET'),
      now: () => new Date(),
      newId: () => crypto.randomUUID(),
    });
  }
  if (path.endsWith('/comp')) {
    // Called by scripts/comp-license.sh, never from a browser, so it sends no CORS headers.
    return handleComp(request, {
      db: db(),
      send: resendSender(env('RESEND_API_KEY')),
      privateKey: signingKey,
      adminSecret: env('LICENSE_ADMIN_SECRET'),
      now: () => new Date(),
    });
  }
  if (path.endsWith('/resend')) {
    const cors = corsHeaders(request.headers.get('origin'), env('SITE_ORIGINS') || undefined);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const ip = clientIp(request);
    const res = await handleResend(request, {
      db: db(),
      send: resendSender(env('RESEND_API_KEY')),
      privateKey: signingKey,
      verify: turnstile(env('TURNSTILE_SECRET_KEY')),
      ip,
      // The pepper is the database key, which only the function holds (as on the site).
      rateKey: await ipHash(ip ?? 'unknown', dbKey(env)),
    });
    for (const [name, value] of Object.entries(cors)) res.headers.set(name, value);
    return res;
  }
  return json({ error: 'not_found' }, 404);
}

Deno.serve(async (request) => {
  try {
    return await route(request);
  } catch (e) {
    // Any failure answers an error, so Stripe retries; the message never holds a secret.
    console.error('license function failed:', (e as Error).message);
    return json({ error: 'unavailable' }, 503);
  }
});
