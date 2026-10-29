// Wires the gate to the real Supabase and Resend from the Vercel environment (Decision 12: only
// these functions hold the service key). api/*.ts call this; the tests inject fakes instead.
import { createClient } from '@supabase/supabase-js';
import type { GateDb, GateDeps } from './gate.ts';
import { mailerFor, siteUrlFrom } from './mail.js';

export function gateDeps(request: Request): GateDeps {
  const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY must be set');
  const db = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as unknown as GateDb;
  return { db, send: mailerFor(request, process.env, fetch), siteUrl: siteUrlFrom(process.env) };
}
