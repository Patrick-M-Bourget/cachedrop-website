import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// Emails in the signup language (Decision 5, #14) on a Vercel preview: a French signup gets the
// French email with /fr/ links whose token downloads, and a later English signup switches the stored
// language back. Skipped unless PREVIEW_URL is set; run it like tests/gate-journey.spec.ts. The
// stored-language checks also need SUPABASE_URL and SUPABASE_SECRET_KEY for cachedrop-dev.
const PREVIEW = process.env.PREVIEW_URL;
const OIDC = process.env.VERCEL_OIDC_TOKEN;
const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
const dev =
  SUPABASE_URL && SUPABASE_SECRET_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;

test.skip(!PREVIEW, 'set PREVIEW_URL to run the journey against a preview');

const protection = (): Record<string, string> => (OIDC ? { 'x-vercel-trusted-oidc-idp-token': OIDC } : {});
const email = `french-email-journey+${Date.now()}@example.com`;

test.afterAll(async () => {
  if (dev) await dev.from('signups').delete().eq('email', email);
});

test('a French signup gets the French email; a later English one switches back', async ({ request }) => {
  const signup = async (lang: string) => {
    const res = await request.post('/api/signup', {
      // Previews hold Turnstile's always-pass key, and this run counts under its own rate-limit key (#12).
      headers: { ...protection(), 'x-capture-email': '1', 'x-rate-limit-key': `french-email-journey-${email}` },
      data: { email, lang, turnstile: 'XXXX.DUMMY.TOKEN.XXXX' },
    });
    expect(res.status()).toBe(200);
    return (await res.json()).captured as { subject: string; text: string; headers: Record<string, string> };
  };
  const storedLang = async () => (await dev!.from('signups').select('lang').eq('email', email).single()).data?.lang;

  const fr = await signup('fr');
  expect(fr.subject).toBe('Votre lien de téléchargement CacheDrop');
  const token = fr.text.match(/https:\/\/\S+\/fr\/download\/([A-Za-z0-9_-]{43})\//)![1];
  expect(fr.text).toMatch(/https:\/\/\S+\/fr\/unsubscribe\/[A-Za-z0-9_-]{43}\//);
  expect(fr.text).toMatch(/https:\/\/\S+\/fr\/privacy\//);
  expect(fr.headers['List-Unsubscribe']).toMatch(/^<https:\/\/\S+\/api\/unsubscribe\?token=[A-Za-z0-9_-]{43}&lang=fr>$/);
  expect(fr.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  const start = await request.get(`/api/download?token=${token}`, { headers: protection(), maxRedirects: 0 });
  expect(start.status()).toBe(302);
  if (dev) expect(await storedLang()).toBe('fr');

  const en = await signup('en');
  expect(en.subject).toBe('Your CacheDrop download link');
  expect(en.text).not.toContain('/fr/');
  if (dev) expect(await storedLang()).toBe('en');
});
