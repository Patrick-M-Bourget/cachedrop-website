import { describe, expect, it } from 'vitest';
import { buyHref, isPricingLive, withLaunch } from './pricing';

// Decision 44: one build-time setting, off unless it is exactly "1".
describe('the launch setting', () => {
  it('is on only for "1"', () => {
    expect(isPricingLive('1')).toBe(true);
    for (const value of [undefined, '', '0', 'true', 'yes', ' 1']) expect(isPricingLive(value), String(value)).toBe(false);
  });

  it('keeps the base copy when off and lays the launch copy over it when on', () => {
    const base = { download: 'Get Free Beta', home: 'Home' };
    expect(withLaunch(base, { download: 'Download Free' }, false)).toBe(base);
    expect(withLaunch(base, { download: 'Download Free' }, true)).toEqual({ download: 'Download Free', home: 'Home' });
  });

  it('sends Buy to /buy, with ?lang=fr from French pages (Decision 41)', () => {
    expect(buyHref('en')).toBe('/buy');
    expect(buyHref('fr')).toBe('/buy?lang=fr');
  });
});
