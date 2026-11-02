// The same modules under Deno, the runtime the Edge Function deploys to: the format doc's test
// vector and the Stripe signature check. Vitest covers the rest (*.test.ts). Run by hand:
//   deno test supabase/functions/license/deno_test.ts
// No imports beyond the function's own files, so tsc can check this file too.
import { importPrivateKey, signLicenseKey } from './key.ts';
import { signStripePayload, verifyStripeSignature } from './stripe-signature.ts';
import { TEST_SEED, VECTOR } from './test-key.ts';

const { Deno } = globalThis as unknown as { Deno: { test(name: string, fn: () => Promise<void>): void } };

function assertEquals(actual: unknown, expected: unknown) {
  if (actual !== expected) throw new Error(`expected ${String(expected)}, got ${String(actual)}`);
}

Deno.test('the key reproduces the format doc test vector', async () => {
  const key = await signLicenseKey(await importPrivateKey(TEST_SEED), { id: VECTOR.id, macs: 3, issueDay: 20758 });
  assertEquals(key, VECTOR.key);
});

Deno.test('the Stripe signature check accepts a valid header and rejects tampering, the wrong secret and a stale time', async () => {
  const body = '{"id":"evt_1","type":"checkout.session.completed"}';
  const now = 1_793_500_000;
  const header = await signStripePayload(body, 'whsec_deno', now);
  assertEquals(await verifyStripeSignature(body, header, 'whsec_deno', now), true);
  assertEquals(await verifyStripeSignature(body.replace('evt_1', 'evt_2'), header, 'whsec_deno', now), false);
  assertEquals(await verifyStripeSignature(body, header, 'whsec_other', now), false);
  assertEquals(await verifyStripeSignature(body, header, 'whsec_deno', now + 301), false);
  assertEquals(await verifyStripeSignature(body, null, 'whsec_deno', now), false);
});
