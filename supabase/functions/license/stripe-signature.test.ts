// The Stripe-Signature check: a valid header passes; a tampered body, the wrong secret, a stale or
// future timestamp, and missing or malformed headers fail.
import { describe, expect, it } from 'vitest';
import { TOLERANCE_SECONDS, signStripePayload, verifyStripeSignature } from './stripe-signature.ts';

const SECRET = 'whsec_test_secret_for_unit_tests';
const BODY = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' });
const NOW = 1_793_500_000;

describe('verifyStripeSignature', () => {
  it('accepts a header Stripe would send', async () => {
    const header = await signStripePayload(BODY, SECRET, NOW);
    expect(header).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
    expect(await verifyStripeSignature(BODY, header, SECRET, NOW)).toBe(true);
  });

  it('accepts any matching v1 among several (secret rolling) and ignores v0', async () => {
    const good = await signStripePayload(BODY, SECRET, NOW);
    const v1 = good.split('v1=')[1];
    const header = `t=${NOW},v1=${'0'.repeat(64)},v0=${'1'.repeat(64)},v1=${v1}`;
    expect(await verifyStripeSignature(BODY, header, SECRET, NOW)).toBe(true);
  });

  it('rejects a tampered body', async () => {
    const header = await signStripePayload(BODY, SECRET, NOW);
    expect(await verifyStripeSignature(BODY.replace('evt_1', 'evt_2'), header, SECRET, NOW)).toBe(false);
  });

  it('rejects the wrong secret', async () => {
    const header = await signStripePayload(BODY, 'whsec_someone_else', NOW);
    expect(await verifyStripeSignature(BODY, header, SECRET, NOW)).toBe(false);
  });

  it('rejects a timestamp outside the tolerance, either way', async () => {
    const old = await signStripePayload(BODY, SECRET, NOW - TOLERANCE_SECONDS - 1);
    expect(await verifyStripeSignature(BODY, old, SECRET, NOW)).toBe(false);
    const future = await signStripePayload(BODY, SECRET, NOW + TOLERANCE_SECONDS + 1);
    expect(await verifyStripeSignature(BODY, future, SECRET, NOW)).toBe(false);
    const edge = await signStripePayload(BODY, SECRET, NOW - TOLERANCE_SECONDS);
    expect(await verifyStripeSignature(BODY, edge, SECRET, NOW)).toBe(true);
  });

  it('rejects a changed timestamp, since it is signed too', async () => {
    const header = await signStripePayload(BODY, SECRET, NOW);
    expect(await verifyStripeSignature(BODY, header.replace(`t=${NOW}`, `t=${NOW + 1}`), SECRET, NOW)).toBe(false);
  });

  it('rejects missing, unsigned and malformed headers', async () => {
    for (const header of [null, '', 't=', `t=${NOW}`, `v1=${'a'.repeat(64)}`, `t=abc,v1=${'a'.repeat(64)}`, `t=${NOW},v1=zz`]) {
      expect(await verifyStripeSignature(BODY, header, SECRET, NOW)).toBe(false);
    }
  });

  it('rejects everything without a secret', async () => {
    const header = await signStripePayload(BODY, SECRET, NOW);
    expect(await verifyStripeSignature(BODY, header, '', NOW)).toBe(false);
  });
});
