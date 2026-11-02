// The license key format, version 1 (mac-cleaner docs/reference/license-key-format.md, its
// Decision 136): "CD1-" and the unpadded upper-case RFC 4648 base32 of a 21-byte payload followed by
// its 64-byte Ed25519 signature. Web Crypto only, so it runs the same in Deno and in Vitest.

export interface LicenseFields {
  /** The license ID, a lower-case hyphenated UUID. */
  id: string;
  /** Macs the license covers, 1 to 255 (honour-based). */
  macs: number;
  /** Whole UTC days since 1970-01-01. */
  issueDay: number;
}

/** Edition byte 1: standard, the only edition format version 1 knows. */
const STANDARD = 1;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DAY_MS = 86_400_000;
/** PKCS#8 DER prefix that wraps a raw 32-byte Ed25519 seed (RFC 8410). */
const PKCS8_PREFIX = '302e020100300506032b657004220420';

const fromHex = (hex: string) => Uint8Array.from(hex.match(/../g) ?? [], (h) => parseInt(h, 16));

/** Whole days since 1970-01-01 UTC. */
export const issueDay = (date: Date) => Math.floor(date.getTime() / DAY_MS);

/**
 * The Ed25519 signing key from the secret: the 32-byte private seed as 64 hex characters, the way
 * the format doc writes its test seed.
 */
export async function importPrivateKey(seedHex: string): Promise<CryptoKey> {
  if (!/^[0-9a-fA-F]{64}$/.test(seedHex)) throw new Error('The license private key must be a 32-byte seed as 64 hex characters');
  const der = fromHex(PKCS8_PREFIX + seedHex.toLowerCase());
  return crypto.subtle.importKey('pkcs8', der, { name: 'Ed25519' }, false, ['sign']);
}

/** The 21 signed bytes: version, license ID, edition, Macs, issue day (big-endian). */
export function licensePayload({ id, macs, issueDay }: LicenseFields): Uint8Array {
  if (!UUID.test(id)) throw new Error('The license ID must be a lower-case hyphenated UUID');
  if (!Number.isInteger(macs) || macs < 1 || macs > 255) throw new Error('Macs must be 1 to 255');
  if (!Number.isInteger(issueDay) || issueDay < 0 || issueDay > 0xffff) throw new Error('The issue day must fit 16 bits');
  const payload = new Uint8Array(21);
  payload[0] = 1;
  payload.set(fromHex(id.replaceAll('-', '')), 1);
  payload[17] = STANDARD;
  payload[18] = macs;
  new DataView(payload.buffer).setUint16(19, issueDay);
  return payload;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** RFC 4648 base32, upper case, no padding. */
export function base32(bytes: Uint8Array): string {
  let out = '';
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = ((buffer << 8) | byte) & 0xffff;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += ALPHABET[(buffer >> bits) & 31];
    }
  }
  if (bits > 0) out += ALPHABET[(buffer << (5 - bits)) & 31];
  return out;
}

/** The canonical key: "CD1-" and 136 base32 characters, one line. */
export async function signLicenseKey(privateKey: CryptoKey, fields: LicenseFields): Promise<string> {
  const payload = licensePayload(fields);
  const signature = new Uint8Array(await crypto.subtle.sign('Ed25519', privateKey, payload as Uint8Array<ArrayBuffer>));
  const all = new Uint8Array(85);
  all.set(payload);
  all.set(signature, 21);
  return `CD1-${base32(all)}`;
}
