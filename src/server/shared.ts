// What every function in src/server/ shares: the JSON response, the shape of a supabase-js call's
// result, the environment, and the email check. The site's languages (Lang) live in src/i18n.ts.

/** What a supabase-js rpc() call resolves to. */
export type Result<T> = Promise<{ data: T | null; error: { message: string } | null }>;

/** The Vercel environment, or the slice of it a test passes in. */
export type Env = Record<string, string | undefined>;

/** A JSON answer that no cache keeps. */
export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });

// One @, something on each side, a dot in the domain, no spaces. The emailed link is the real check.
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
