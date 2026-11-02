import { describe, expect, it } from 'vitest';
import { licenseEmail } from './email.ts';

const KEY = 'CD1-' + 'A'.repeat(136);
const ID = '5f0c2a8e-3b1d-4c6f-9a7e-2d4b8c1e6f30';

describe('license email (#72)', () => {
  it('links "cachedrop.io" in the keep line to the English resend page', () => {
    const email = licenseEmail('a@example.com', 'en', KEY, ID);
    expect(email.html).toContain('you can have it sent again from <a href="https://cachedrop.io/resend-license-key/"');
    expect(email.text).toContain('you can have it sent again from https://cachedrop.io/resend-license-key/.');
  });

  it('links the French keep line to the French resend page', () => {
    const email = licenseEmail('a@example.com', 'fr', KEY, ID);
    expect(email.html).toContain('à partir de <a href="https://cachedrop.io/fr/resend-license-key/"');
    expect(email.text).toContain('à partir de https://cachedrop.io/fr/resend-license-key/.');
  });

  it('follows the site URL it is given', () => {
    const email = licenseEmail('a@example.com', 'en', KEY, ID, 'https://preview.example');
    expect(email.html).toContain('href="https://preview.example/resend-license-key/"');
  });
});
