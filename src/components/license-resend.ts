// Where the "Resend my license key" form posts (Decision 42): the license Edge Function's resend
// route (Decision 40) on the Supabase project the site is configured with. The build reads
// SUPABASE_URL, the same variable the Vercel functions use, so Preview reaches the dev project and
// Production the prod one without a project ref in the code.

/** The path on a Supabase project. Local builds and CI post here on the site itself, where tests answer it. */
export const LOCAL_ENDPOINT = '/functions/v1/license/resend';

/** The URL the form posts to. A production build without SUPABASE_URL fails instead of shipping a form that goes nowhere. */
export function resendEndpoint(supabaseUrl: string | undefined, vercelEnv: string | undefined): string {
  if (!supabaseUrl) {
    if (vercelEnv === 'production') throw new Error('SUPABASE_URL must be set for a production build');
    return LOCAL_ENDPOINT;
  }
  const url = new URL(supabaseUrl);
  if (url.protocol !== 'https:') throw new Error('SUPABASE_URL must be an https URL');
  return `${url.origin}${LOCAL_ENDPOINT}`;
}
