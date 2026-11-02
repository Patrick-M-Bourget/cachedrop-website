// The license function's handlers with Supabase, Resend and Turnstile stood in for at the boundary
// (Decision 27). The SQL functions are faked in memory with the migration's semantics.
import { describe, expect, it, vi } from 'vitest';
import type { Email } from './email.ts';
import { handleComp, handleResend, handleStripeWebhook, MACS, RESEND_LIMIT, type CompDeps, type LicenseDb, type LicenseRow, type ResendDeps, type WebhookDeps } from './handlers.ts';
import { importPrivateKey } from './key.ts';
import { signStripePayload } from './stripe-signature.ts';
import { TEST_SEED } from './test-key.ts';

const SECRET = 'whsec_unit_tests';
const NOW = new Date('2026-11-01T12:00:00Z');
const SESSION = 'cs_test_a1B2c3D4';
const URL_ = 'https://example.supabase.co/functions/v1/license/stripe-webhook';
const KEY_LINE = /^CD1-[A-Z2-7]{136}$/m;

/** issue_license, comp_license, mark_license_emailed, licenses_for_email and hit_rate_limit, in memory. */
function fakeDb(opts: { failIssue?: boolean } = {}) {
  const rows = new Map<string, LicenseRow & { session: string | null; customer: string | null; note?: string | null }>();
  const hits = new Map<string, number>();
  const db = {
    rows,
    async rpc(fn: string, a: Record<string, unknown>) {
      if (fn === 'issue_license') {
        if (opts.failIssue) return { data: null, error: { message: 'down' } };
        let row = [...rows.values()].find((r) => r.session === a.p_stripe_session_id);
        if (!row) {
          row = {
            id: a.p_id as string, edition: 'standard', macs: a.p_macs as number, issue_day: a.p_issue_day as number,
            email: a.p_email as string, lang: a.p_lang as 'en' | 'fr', emailed_at: null,
            session: a.p_stripe_session_id as string, customer: a.p_stripe_customer_id as string | null, source: 'stripe',
          };
          rows.set(row.id, row);
        }
        const { source: _, ...bought } = row; // issue_license's columns don't include source
        return { data: [bought], error: null };
      }
      if (fn === 'comp_license') {
        let row = rows.get(a.p_id as string);
        if (!row) {
          row = {
            id: a.p_id as string, edition: 'standard', macs: a.p_macs as number, issue_day: a.p_issue_day as number,
            email: a.p_email as string, lang: a.p_lang as 'en' | 'fr', emailed_at: null,
            session: null, customer: null, source: 'comp', note: a.p_note as string | null,
          };
          rows.set(row.id, row);
        }
        return { data: row.source === 'comp' ? [{ ...row }] : [], error: null };
      }
      if (fn === 'mark_license_emailed') {
        const row = rows.get(a.p_id as string);
        if (row) row.emailed_at ??= NOW.toISOString();
        return { data: !!row, error: null };
      }
      if (fn === 'licenses_for_email') return { data: [...rows.values()].filter((r) => r.email === a.p_email), error: null };
      if (fn === 'hit_rate_limit') {
        const n = (hits.get(a.p_ip_hash as string) ?? 0) + 1;
        hits.set(a.p_ip_hash as string, n);
        return { data: n <= (a.p_limit as number) ? 0 : 1800, error: null };
      }
      throw new Error(`unexpected rpc ${fn}`);
    },
  };
  return db as typeof db & LicenseDb;
}

function fakeSend(fail = false) {
  const sent: Array<{ email: Email; idempotencyKey?: string }> = [];
  const send = async (email: Email, idempotencyKey?: string) => {
    if (fail) throw new Error('Resend answered 500');
    sent.push({ email, idempotencyKey });
  };
  return { send, sent };
}

let ids = 0;
function webhookDeps(db: LicenseDb, send: WebhookDeps['send']): WebhookDeps {
  return {
    db, send, webhookSecret: SECRET, now: () => NOW,
    privateKey: () => importPrivateKey(TEST_SEED),
    newId: () => `00000000-0000-4000-8000-${String(++ids).padStart(12, '0')}`,
  };
}

const session = (over: Record<string, unknown> = {}) => ({
  id: SESSION, object: 'checkout.session', mode: 'payment', payment_status: 'paid', locale: null,
  customer: 'cus_Buyer1', customer_details: { email: 'Buyer@Example.com' }, amount_total: 1999, ...over,
});
const event = (obj: Record<string, unknown>, type = 'checkout.session.completed') =>
  JSON.stringify({ id: 'evt_1', type, data: { object: obj } });

async function stripeRequest(body: string, opts: { secret?: string; at?: number; header?: string | null } = {}) {
  const header = opts.header !== undefined ? opts.header : await signStripePayload(body, opts.secret ?? SECRET, opts.at ?? NOW.getTime() / 1000);
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (header !== null) headers['stripe-signature'] = header;
  return new Request(URL_, { method: 'POST', headers, body });
}

describe('handleStripeWebhook', () => {
  it('stores one standard 3-Mac license and emails its key after a paid session', async () => {
    const db = fakeDb();
    const { send, sent } = fakeSend();
    const res = await handleStripeWebhook(await stripeRequest(event(session())), webhookDeps(db, send));
    expect(res.status).toBe(200);
    expect(db.rows.size).toBe(1);
    const row = [...db.rows.values()][0];
    expect(row).toMatchObject({ edition: 'standard', macs: MACS, issue_day: 20758, email: 'buyer@example.com', lang: 'en', session: SESSION, customer: 'cus_Buyer1' });
    expect(row.emailed_at).not.toBeNull();
    expect(sent).toHaveLength(1);
    expect(sent[0].email.to).toBe('buyer@example.com');
    expect(sent[0].email.text).toMatch(KEY_LINE);
    expect(sent[0].email.text).toContain(row.id);
    expect(sent[0].idempotencyKey).toBe(`license-${row.id}`);
  });

  it('treats the full price like the discounted one', async () => {
    const db = fakeDb();
    const { send } = fakeSend();
    await handleStripeWebhook(await stripeRequest(event(session({ amount_total: 2999 }))), webhookDeps(db, send));
    expect([...db.rows.values()][0]).toMatchObject({ edition: 'standard', macs: 3 });
  });

  it('issues and sends nothing on a replay of the same session', async () => {
    const db = fakeDb();
    const { send, sent } = fakeSend();
    const deps = webhookDeps(db, send);
    expect((await handleStripeWebhook(await stripeRequest(event(session())), deps)).status).toBe(200);
    const again = await handleStripeWebhook(await stripeRequest(event(session(), 'checkout.session.async_payment_succeeded')), deps);
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ ok: true, repeat: true });
    expect(db.rows.size).toBe(1);
    expect(sent).toHaveLength(1);
  });

  it('answers an error when the email fails, and a retry sends the same key', async () => {
    const db = fakeDb();
    const failing = await handleStripeWebhook(await stripeRequest(event(session())), webhookDeps(db, fakeSend(true).send));
    expect(failing.status).toBe(502);
    expect([...db.rows.values()][0].emailed_at).toBeNull();
    const { send, sent } = fakeSend();
    expect((await handleStripeWebhook(await stripeRequest(event(session())), webhookDeps(db, send))).status).toBe(200);
    expect(db.rows.size).toBe(1);
    expect(sent).toHaveLength(1);
    const { send: send2, sent: sent2 } = fakeSend();
    await handleResend(resendRequest('buyer@example.com'), resendDeps(db, send2));
    expect(sent2[0].email.text.match(KEY_LINE)?.[0]).toBe(sent[0].email.text.match(KEY_LINE)?.[0]);
  });

  it('answers an error when the license cannot be stored, and sends nothing', async () => {
    const { send, sent } = fakeSend();
    const res = await handleStripeWebhook(await stripeRequest(event(session())), webhookDeps(fakeDb({ failIssue: true }), send));
    expect(res.status).toBe(503);
    expect(sent).toHaveLength(0);
  });

  it('logs why the license could not be stored (#76)', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { send } = fakeSend();
    await handleStripeWebhook(await stripeRequest(event(session())), webhookDeps(fakeDb({ failIssue: true }), send));
    expect(log).toHaveBeenCalledWith('issue_license failed:', 'down');
    log.mockRestore();
  });

  it('rejects forged, unsigned, stale and tampered requests and issues nothing', async () => {
    const body = event(session());
    const requests = [
      await stripeRequest(body, { header: null }),
      await stripeRequest(body, { secret: 'whsec_forger' }),
      await stripeRequest(body, { at: NOW.getTime() / 1000 - 301 }),
      new Request(URL_, { method: 'POST', headers: { 'stripe-signature': (await stripeRequest(body)).headers.get('stripe-signature')! }, body: body.replace('Buyer@', 'Thief@') }),
    ];
    const db = fakeDb();
    const { send, sent } = fakeSend();
    for (const req of requests) expect((await handleStripeWebhook(req, webhookDeps(db, send))).status).toBe(400);
    expect(db.rows.size).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it('refuses everything when the signing secret is not set', async () => {
    const db = fakeDb();
    const res = await handleStripeWebhook(await stripeRequest(event(session())), { ...webhookDeps(db, fakeSend().send), webhookSecret: '' });
    expect(res.status).toBe(503);
    expect(db.rows.size).toBe(0);
  });

  it('ignores other events and unpaid sessions without issuing', async () => {
    const db = fakeDb();
    const { send } = fakeSend();
    for (const body of [event(session(), 'payment_intent.succeeded'), event(session({ payment_status: 'unpaid' })), event(session({ mode: 'subscription' }))]) {
      const res = await handleStripeWebhook(await stripeRequest(body), webhookDeps(db, send));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ignored: true });
    }
    expect(db.rows.size).toBe(0);
  });

  it('emails French buyers in French', async () => {
    for (const over of [{ locale: 'fr-CA' }, { metadata: { lang: 'fr' } }]) {
      const db = fakeDb();
      const { send, sent } = fakeSend();
      await handleStripeWebhook(await stripeRequest(event(session(over))), webhookDeps(db, send));
      expect([...db.rows.values()][0].lang).toBe('fr');
      expect(sent[0].email.subject).toBe('Votre clé de licence CacheDrop');
      expect(sent[0].email.html).toContain('/fr/privacy/');
    }
  });

  it('stores no customer when Stripe made none', async () => {
    const db = fakeDb();
    await handleStripeWebhook(await stripeRequest(event(session({ customer: null }))), webhookDeps(db, fakeSend().send));
    expect([...db.rows.values()][0].customer).toBeNull();
  });

  it('answers 422 to a paid session without an email', async () => {
    const db = fakeDb();
    const res = await handleStripeWebhook(await stripeRequest(event(session({ customer_details: null }))), webhookDeps(db, fakeSend().send));
    expect(res.status).toBe(422);
    expect(db.rows.size).toBe(0);
  });
});

const PASS = 'turnstile-pass';
const resendRequest = (email: string, extra: Record<string, unknown> = {}) =>
  new Request('https://example.supabase.co/functions/v1/license/resend', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, turnstile: PASS, ...extra }),
  });
function resendDeps(db: LicenseDb, send: ResendDeps['send'], verdict: 'ok' | 'failed' | 'unavailable' = 'ok'): ResendDeps {
  return {
    db, send, privateKey: () => importPrivateKey(TEST_SEED),
    verify: async (token) => (token === PASS ? verdict : 'failed'),
    ip: '203.0.113.7', rateKey: 'a'.repeat(64),
  };
}

describe('handleResend', () => {
  async function bought(db: LicenseDb) {
    await handleStripeWebhook(await stripeRequest(event(session())), webhookDeps(db, fakeSend().send));
  }

  it('emails the key again, in the language asked for', async () => {
    const db = fakeDb();
    await bought(db);
    const { send, sent } = fakeSend();
    const res = await handleResend(resendRequest(' BUYER@example.com ', { lang: 'fr' }), resendDeps(db, send));
    expect(res.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0].email.to).toBe('buyer@example.com');
    expect(sent[0].email.subject).toBe('Votre clé de licence CacheDrop');
    expect(sent[0].email.text).toMatch(KEY_LINE);
  });

  it('answers the same for an address that bought nothing, and sends nothing', async () => {
    const db = fakeDb();
    await bought(db);
    const { send, sent } = fakeSend();
    const res = await handleResend(resendRequest('someone@example.com'), resendDeps(db, send));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(sent).toHaveLength(0);
  });

  it('runs the bot check first', async () => {
    const db = fakeDb();
    await bought(db);
    const { send, sent } = fakeSend();
    expect((await handleResend(resendRequest('buyer@example.com', { turnstile: 'nope' }), resendDeps(db, send))).status).toBe(403);
    expect((await handleResend(resendRequest('buyer@example.com', { turnstile: undefined }), resendDeps(db, send))).status).toBe(403);
    expect((await handleResend(resendRequest('buyer@example.com'), resendDeps(db, send, 'unavailable'))).status).toBe(503);
    expect(sent).toHaveLength(0);
  });

  it('limits requests per place, like the download form', async () => {
    const db = fakeDb();
    await bought(db);
    const { send, sent } = fakeSend();
    for (let i = 0; i < RESEND_LIMIT.limit; i++) expect((await handleResend(resendRequest('buyer@example.com'), resendDeps(db, send))).status).toBe(200);
    const over = await handleResend(resendRequest('buyer@example.com'), resendDeps(db, send));
    expect(over.status).toBe(429);
    expect(over.headers.get('retry-after')).toBe('1800');
    expect(sent).toHaveLength(RESEND_LIMIT.limit);
  });

  it('refuses a bad email before the bot check', async () => {
    const { send } = fakeSend();
    expect((await handleResend(resendRequest('not-an-email'), resendDeps(fakeDb(), send))).status).toBe(400);
  });
});

const ADMIN = 's'.repeat(40);
const COMP_ID = '6a1f3c2e-8b4d-4e5f-9a0b-1c2d3e4f5a6b';
const compRequest = (body: Record<string, unknown>, auth: string | null = `Bearer ${ADMIN}`) =>
  new Request('https://example.supabase.co/functions/v1/license/comp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(auth ? { authorization: auth } : {}) },
    body: JSON.stringify({ id: COMP_ID, email: 'Friend@Example.com', ...body }),
  });
const compDeps = (db: LicenseDb, send: CompDeps['send'], adminSecret = ADMIN): CompDeps =>
  ({ db, send, adminSecret, privateKey: () => importPrivateKey(TEST_SEED), now: () => NOW });

describe('handleComp (Decision 45)', () => {
  it('stores a free 3-Mac license with its note and emails the key in the gift wording', async () => {
    const db = fakeDb();
    const { send, sent } = fakeSend();
    const res = await handleComp(compRequest({ note: ' beta tester ' }), compDeps(db, send));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, id: COMP_ID });
    const row = db.rows.get(COMP_ID)!;
    expect(row).toMatchObject({ source: 'comp', email: 'friend@example.com', macs: MACS, note: 'beta tester', session: null, issue_day: 20758 });
    expect(row.emailed_at).not.toBeNull();
    expect(sent).toHaveLength(1);
    expect(sent[0].idempotencyKey).toBe(`license-${COMP_ID}`);
    expect(sent[0].email.text).toMatch(KEY_LINE);
    expect(sent[0].email.text).toContain('A CacheDrop license, on us');
    expect(sent[0].email.text).not.toContain('refund');
  });

  it('sends nothing more when run again with the same ID, and the same key after a failed email', async () => {
    const db = fakeDb();
    expect((await handleComp(compRequest({ lang: 'fr' }), compDeps(db, fakeSend(true).send))).status).toBe(502);
    const first = fakeSend();
    expect((await handleComp(compRequest({ lang: 'fr' }), compDeps(db, first.send))).status).toBe(200);
    expect(first.sent[0].email.subject).toBe('Votre clé de licence CacheDrop');
    const again = fakeSend();
    const res = await handleComp(compRequest({ lang: 'fr' }), compDeps(db, again.send));
    expect(await res.json()).toEqual({ ok: true, repeat: true, id: COMP_ID });
    expect(again.sent).toHaveLength(0);
    expect(db.rows.size).toBe(1);
  });

  it('never sends the key of a license with the same ID for another address or a purchase', async () => {
    const db = fakeDb();
    await handleComp(compRequest({}), compDeps(db, fakeSend().send));
    const { send, sent } = fakeSend();
    expect((await handleComp(compRequest({ email: 'other@example.com' }), compDeps(db, send))).status).toBe(409);
    await handleStripeWebhook(await stripeRequest(event(session())), webhookDeps(db, fakeSend().send));
    const boughtId = [...db.rows.values()].find((r) => r.source === 'stripe')!.id;
    expect((await handleComp(compRequest({ id: boughtId, email: 'buyer@example.com' }), compDeps(db, send))).status).toBe(409);
    expect(sent).toHaveLength(0);
  });

  it('refuses a missing or wrong secret, and everything while the secret is unset', async () => {
    const db = fakeDb();
    const { send, sent } = fakeSend();
    expect((await handleComp(compRequest({}, null), compDeps(db, send))).status).toBe(401);
    expect((await handleComp(compRequest({}, `Bearer ${'t'.repeat(40)}`), compDeps(db, send))).status).toBe(401);
    expect((await handleComp(compRequest({}, ADMIN), compDeps(db, send))).status).toBe(401);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await handleComp(compRequest({}, 'Bearer '), compDeps(db, send, ''))).status).toBe(503);
    expect((await handleComp(compRequest({}, 'Bearer short'), compDeps(db, send, 'short'))).status).toBe(503);
    expect(db.rows.size).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it('refuses a bad ID, email, language or note', async () => {
    const { send } = fakeSend();
    const status = async (body: Record<string, unknown>) => (await handleComp(compRequest(body), compDeps(fakeDb(), send))).status;
    expect(await status({ id: 'not-a-uuid' })).toBe(400);
    expect(await status({ email: 'nope' })).toBe(400);
    expect(await status({ lang: 'de' })).toBe(400);
    expect(await status({ note: 'x'.repeat(201) })).toBe(400);
    expect(await status({ note: 42 })).toBe(400);
  });

  it('resends a free license in the gift wording', async () => {
    const db = fakeDb();
    await handleComp(compRequest({}), compDeps(db, fakeSend().send));
    const { send, sent } = fakeSend();
    expect((await handleResend(resendRequest('friend@example.com'), resendDeps(db, send))).status).toBe(200);
    expect(sent[0].email.text).toContain('A CacheDrop license, on us');
  });
});
