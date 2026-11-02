// Wires the gate to the real Supabase and Resend from the Vercel environment (Decision 12: only
// these functions hold the service key). api/*.ts call this; the tests inject fakes instead.
import { createClient } from '@supabase/supabase-js';
import { clientIp, rateLimitKey, turnstileFor, type Guard } from './bot-check.js';
import type { FeedbackDb, RetryDeps, SubmitDeps } from './feedback.ts';
import type { GateDb, GateDeps, SignupDeps } from './gate.ts';
import type { TelemetryDb, TelemetryDeps } from './telemetry.ts';
import { issuesFor } from './github.js';
import { mailerFor, siteUrlFrom } from './mail.js';

function serviceClient() {
  const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY must be set');
  return createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function gateDeps(request: Request): GateDeps {
  const db = serviceClient() as unknown as GateDb;
  // The same variable the pages are built with (Decision 44), read here at run time.
  const pricingLive = process.env.PUBLIC_PRICING_LIVE === '1';
  return { db, send: mailerFor(request, process.env, fetch), siteUrl: siteUrlFrom(process.env), pricingLive };
}

/** The bot check and rate limit for one form submission (Decision 12), minus the database. */
function guardFor(request: Request): Omit<Guard, 'db'> {
  return { verify: turnstileFor(request, process.env, fetch), ip: clientIp(request), rateKey: rateLimitKey(request, process.env) };
}

/** api/signup: the gate, behind the bot check and rate limit. */
export function signupDeps(request: Request): SignupDeps {
  return { ...gateDeps(request), ...guardFor(request) };
}

/** Feedback: Supabase, and mac-cleaner's issues in production or test mode elsewhere. */
export function feedbackDeps(): RetryDeps {
  const db = serviceClient() as unknown as FeedbackDb;
  return { db, issues: issuesFor(process.env, fetch), cronSecret: process.env.CRON_SECRET, now: Date.now };
}

/** api/feedback: feedback, behind the bot check and rate limit. */
export function submitDeps(request: Request): SubmitDeps {
  return { ...feedbackDeps(), ...guardFor(request) };
}

/** api/telemetry: the app's setup progress, behind the rate limit only (the app can't run Turnstile). */
export function telemetryDeps(request: Request): TelemetryDeps {
  return { db: serviceClient() as unknown as TelemetryDb, rateKey: rateLimitKey(request, process.env) };
}
