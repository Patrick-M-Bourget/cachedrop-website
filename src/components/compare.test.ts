import { describe, expect, it } from 'vitest';
import { billingText, checkedOn, compareDescription, priceText, productName, rows, threeYears, threeYearsText } from './compare';
import { price, pricingCopy } from './pricing';

// Decision 54: the CleanMyMac alternative page's price table.
describe('the compare table', () => {
  it('puts CacheDrop first, at the regular price, never the offer (Decision 47)', () => {
    expect(rows[0]).toMatchObject({ product: 'CacheDrop', us: true, plan: { once: Number(price.regular) }, macs: 3 });
    expect(priceText('en', rows[0].plan)).toBe(pricingCopy.en.was + ' once');
    expect(rows.filter((r) => r.us)).toHaveLength(1);
  });

  it('gives every row a source on the web and the day its price was checked', () => {
    for (const r of rows) {
      expect(r.source, r.product).toMatch(/^https:\/\/[^\s]+$/);
      expect(r.checkedOn, r.product).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(r.checkedOn)), r.product).toBe(false);
    }
  });

  it('dates the note by the oldest check, so it never overstates how fresh the prices are', () => {
    expect(checkedOn()).toBe(rows.map((r) => r.checkedOn).sort()[0]);
  });

  it('lists the Decision 54 products, and no plug-in managers or Setapp', () => {
    const names = rows.map((r) => productName('en', r));
    for (const name of ['CleanMyMac', 'CleanMyMac Essential Trio', 'CleanMyMac (one-time)', 'MacKeeper', 'BuhoCleaner', 'MacCleaner Pro', 'App Cleaner & Uninstaller', 'Sensei', 'Mole', 'DaisyDisk', 'OnyX', 'AppCleaner']) {
      expect(names).toContain(name);
    }
    expect(names.join(' ')).not.toMatch(/PluginHub|Plugin Station|Pluginize|Setapp/);
  });

  it('writes a "Good for" line in both languages for every row', () => {
    for (const r of rows) {
      expect(r.goodFor.en.length, r.product).toBeGreaterThan(10);
      expect(r.goodFor.fr.length, r.product).toBeGreaterThan(10);
    }
  });

  it('never puts "bloat" in a row', () => {
    for (const r of rows) expect(`${r.goodFor.en} ${r.goodFor.fr}`).not.toMatch(/bloat/i);
  });
});

describe('the 3-year cost for 1 Mac', () => {
  it('is the cheaper of paying once and three years of renewals', () => {
    expect(threeYears({ yearly: 39.95 })).toBeCloseTo(119.85);
    expect(threeYears({ yearly: 39.95, once: 85.95 })).toBe(85.95);
    expect(threeYears({ firstYear: 71.4, yearly: 95.4 })).toBeCloseTo(262.2);
    expect(threeYears({ once: 19 })).toBe(19);
    expect(threeYears({})).toBe(0);
  });

  it('formats prices in each language', () => {
    expect(threeYearsText('en', { yearly: 39.95 })).toBe('$119.85');
    expect(threeYearsText('fr', { yearly: 39.95 })).toBe('119,85 $');
    expect(priceText('en', { yearly: 39.95, once: 85.95 })).toBe('$39.95/yr or $85.95 once');
    expect(priceText('fr', { firstYear: 71.4, yearly: 95.4 })).toBe('71,40 $ la 1re année, puis 95,40 $/an');
    expect(priceText('en', { once: 19 })).toBe('$19 once');
    expect(priceText('en', {})).toBe('No cost');
    expect(billingText('en', { yearly: 1, once: 2 })).toBe('Yearly or one-time');
  });
});

describe('the description', () => {
  it('is built from the price, with the offer as pricing.ts words it', () => {
    expect(compareDescription.en).toContain(pricingCopy.en.license);
    expect(compareDescription.fr).toContain(pricingCopy.fr.license);
  });
});
