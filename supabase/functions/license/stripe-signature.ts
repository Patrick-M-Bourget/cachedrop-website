// Checks Stripe's webhook signature with Web Crypto rather than the Stripe SDK (Decision 40), per
// Stripe's documented scheme: https://docs.stripe.com/webhooks#verify-manually
// The Stripe-Signature header is "t=<unix seconds>,v1=<hex HMAC-SHA256>[,v1=…][,v0=…]". The signed
// payload is "<t>.<raw body>", keyed with the endpoint's signing secret (whsec_…). Only v1 counts;
// any matching v1 passes (Stripe sends several while a secret rolls). The timestamp must be within
// the tolerance, so a captured request can't be replayed later.

/** Stripe's libraries default to five minutes. */
export const TOLERANCE_SECONDS = 300;

const encoder = new TextEncoder();

const hmacKey = (secret: string, usage: 'sign' | 'verify') =>
  crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage]);

function fromHex(hex: string): Uint8Array<ArrayBuffer> | null {
  if (!/^(?:[0-9a-f]{2})+$/i.test(hex)) return null;
  return Uint8Array.from(hex.match(/../g)!, (h) => parseInt(h, 16));
}

/**
 * True only when `header` carries a v1 signature of `rawBody` made with `secret` and a timestamp
 * within TOLERANCE_SECONDS of `nowSeconds`. `rawBody` must be the exact bytes Stripe sent, as text.
 */
export async function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  nowSeconds: number,
): Promise<boolean> {
  if (!secret || !header) return false;
  let timestamp: string | null = null;
  const signatures: Uint8Array<ArrayBuffer>[] = [];
  for (const part of header.split(',')) {
    const eq = part.indexOf('=');
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (name === 't') timestamp = value;
    if (name === 'v1') {
      const bytes = fromHex(value);
      if (bytes?.length === 32) signatures.push(bytes);
    }
  }
  if (!timestamp || !/^\d+$/.test(timestamp) || signatures.length === 0) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > TOLERANCE_SECONDS) return false;

  const key = await hmacKey(secret, 'verify');
  const signed = encoder.encode(`${timestamp}.${rawBody}`);
  // subtle.verify compares in constant time.
  for (const signature of signatures) {
    if (await crypto.subtle.verify('HMAC', key, signature, signed)) return true;
  }
  return false;
}

/** A Stripe-Signature header for `rawBody`, the way Stripe makes one. For tests. */
export async function signStripePayload(rawBody: string, secret: string, timestamp: number): Promise<string> {
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret, 'sign'), encoder.encode(`${timestamp}.${rawBody}`)));
  return `t=${timestamp},v1=${Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}
