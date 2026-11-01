// The license key format (mac-cleaner docs/reference/license-key-format.md, Decision 136) against
// its shared test vector, signed with the format doc's TEST key pair. Never the production key.
import { describe, expect, it } from 'vitest';
import { base32, importPrivateKey, issueDay, licensePayload, signLicenseKey } from './key.ts';
import { TEST_PUBLIC, TEST_SEED, VECTOR } from './test-key.ts';

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const unhex = (s: string) => Uint8Array.from(s.match(/../g)!, (h) => parseInt(h, 16));
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function unbase32(s: string): Uint8Array {
  const out: number[] = [];
  let buffer = 0, bits = 0;
  for (const c of s) {
    buffer = ((buffer << 5) | BASE32.indexOf(c)) & 0xffff;
    bits += 5;
    if (bits >= 8) { bits -= 8; out.push((buffer >> bits) & 255); }
  }
  return Uint8Array.from(out);
}

describe('license key', () => {
  it('counts the issue day in whole UTC days since 1970', () => {
    expect(issueDay(new Date('2026-11-01T00:00:00Z'))).toBe(20758);
    expect(issueDay(new Date('2026-11-01T23:59:59Z'))).toBe(20758);
    expect(issueDay(new Date('2026-11-02T00:00:00Z'))).toBe(20759);
  });

  it('lays out the 21-byte payload of the test vector', () => {
    expect(hex(licensePayload({ id: VECTOR.id, macs: 3, issueDay: 20758 }))).toBe(VECTOR.payload);
  });

  it('reproduces the test vector key byte for byte', async () => {
    const key = await signLicenseKey(await importPrivateKey(TEST_SEED), { id: VECTOR.id, macs: 3, issueDay: 20758 });
    expect(key).toBe(VECTOR.key);
    expect(key).toHaveLength(140);
  });

  it('signs keys the test public key verifies', async () => {
    const id = crypto.randomUUID();
    const key = await signLicenseKey(await importPrivateKey(TEST_SEED), { id, macs: 3, issueDay: issueDay(new Date()) });
    expect(key).toMatch(/^CD1-[A-Z2-7]{136}$/);
    const bytes = unbase32(key.slice(4));
    const pub = await crypto.subtle.importKey('raw', unhex(TEST_PUBLIC), { name: 'Ed25519' }, false, ['verify']);
    expect(await crypto.subtle.verify('Ed25519', pub, bytes.slice(21), bytes.slice(0, 21))).toBe(true);
    expect(hex(bytes.slice(1, 17))).toBe(id.replaceAll('-', ''));
  });

  it('encodes RFC 4648 base32 without padding', () => {
    expect(base32(new TextEncoder().encode('foobar'))).toBe('MZXW6YTBOI');
  });

  it('refuses a private key that is not a 32-byte hex seed', async () => {
    await expect(importPrivateKey('abc')).rejects.toThrow(/64 hex/);
    await expect(importPrivateKey(TEST_SEED + '00')).rejects.toThrow(/64 hex/);
  });

  it('refuses fields the format cannot hold', () => {
    expect(() => licensePayload({ id: 'not-a-uuid', macs: 3, issueDay: 1 })).toThrow();
    expect(() => licensePayload({ id: VECTOR.id, macs: 0, issueDay: 1 })).toThrow();
    expect(() => licensePayload({ id: VECTOR.id, macs: 256, issueDay: 1 })).toThrow();
    expect(() => licensePayload({ id: VECTOR.id, macs: 3, issueDay: 65536 })).toThrow();
  });
});
