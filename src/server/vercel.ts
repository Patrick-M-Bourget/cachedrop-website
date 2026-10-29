// Wires the gate to the real Supabase and Resend from the Vercel environment (Decision 12: only
// these functions hold the service key). api/*.ts call this; the tests inject fakes instead.
import { createClient } from '@supabase/supabase-js';
import type { FeedbackDeps, FeedbackDb, RetryDeps } from './feedback.ts';
import type { GateDb, GateDeps } from './gate.ts';
import { issuesFor } from './github.js';
import { mailerFor, siteUrlFrom } from './mail.js';

function serviceClient() {
  const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY must be set');
  return createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function gateDeps(request: Request): GateDeps {
  const db = serviceClient() as unknown as GateDb;
  return { db, send: mailerFor(request, process.env, fetch), siteUrl: siteUrlFrom(process.env) };
}

/** Feedback: Supabase, and mac-cleaner's issues in production or test mode elsewhere. */
export function feedbackDeps(): RetryDeps & FeedbackDeps {
  const db = serviceClient() as unknown as FeedbackDb;
  return { db, issues: issuesFor(process.env, fetch), cronSecret: process.env.CRON_SECRET, now: Date.now };
}
