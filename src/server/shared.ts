// What every function in src/server/ shares: the JSON response, the shape of a supabase-js call's
// result, the environment, and the email check. The site's languages (Lang) live in src/i18n.ts.

/** What a supabase-js rpc() call resolves to. */
export type Result<T> = Promise<{ data: T | null; error: { message: string } | null }>;

/** The Vercel environment, or the slice of it a test passes in. */
export type Env = Record<string, string | undefined>;

/**
 * A preview or local dev deployment, where test modes (email capture, the Turnstile test header,
 * GitHub test mode) may switch on. Only an exact VERCEL_ENV of preview or development counts, so a
 * missing or unexpected value fails closed and behaves like production.
 */
export const isTestDeployment = (env: Env) => env.VERCEL_ENV === 'preview' || env.VERCEL_ENV === 'development';

/** A JSON answer that no cache keeps. */
export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });

// One @, something on each side, a dot in the domain, no spaces. The emailed link is the real check.
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
