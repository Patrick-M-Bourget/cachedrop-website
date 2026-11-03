import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buyHref, discounted, price, pricingCopy } from './pricing';

describe('the Buy link', () => {
  it('sends Buy to /buy, with ?lang=fr from French pages (Decision 41)', () => {
    expect(buyHref('en')).toBe('/buy');
    expect(buyHref('fr')).toBe('/buy?lang=fr');
  });
});

// Decision 47: 29.99 is the price, 19.99 a limited-time offer, and both live only in pricing.ts.
describe('the price', () => {
  it('is 29.99, offered at 19.99 for a limited time', () => {
    expect(price).toEqual({ regular: '29.99', offer: '19.99' });
    expect(discounted).toBe(true);
  });

  it('builds every price string from the two numbers', () => {
    expect(pricingCopy.en).toMatchObject({ was: '$29.99', now: '$19.99', spoken: 'Was $29.99, now $19.99 for a limited time, one-time.', limited: 'Limited-time price' });
    expect(pricingCopy.fr).toMatchObject({ was: '29,99\u00a0$', now: '19,99\u00a0$' });
    expect(pricingCopy.en.license).toBe('$29.99 once, now $19.99 for a limited time');
  });

  it('never calls the offer a launch price in any copy', () => {
    const copy = JSON.stringify(pricingCopy);
    expect(copy).not.toMatch(/launch|lancement/i);
  });

  it('is never written into a page (the terms of sale state it in their own legal wording)', () => {
    const files = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]));
    const pages = files('src/pages').filter((f) => f.endsWith('.astro') && !f.includes('terms-of-sale'));
    const hardCoded = pages.filter((f) => /\b(19|29)[.,]99\b/.test(readFileSync(f, 'utf8')));
    expect(hardCoded).toEqual([]);
  });
});
