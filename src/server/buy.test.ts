import { describe, expect, it } from 'vitest';
import { handleBuy } from './buy.ts';

const EN = 'https://buy.stripe.com/test_en';
const FR = 'https://buy.stripe.com/test_fr';
const SITE = 'https://preview.vercel.app';

function buy(path: string, env: Record<string, string | undefined>) {
  // vercel.json rewrites /buy and /buy/ to /api/buy, keeping the query string.
  return handleBuy(new Request(`${SITE}${path}`), env);
}

describe('/buy redirect (Decision 41)', () => {
  it('sends /buy to the English Payment Link with the launch promo code, uncached', async () => {
    const res = await buy('/api/buy', { BUY_URL_EN: EN, BUY_URL_FR: FR });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(`${EN}?prefilled_promo_code=LAUNCH`);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('sends /buy?lang=fr to the French Payment Link with the launch promo code', async () => {
    const res = await buy('/api/buy?lang=fr', { BUY_URL_EN: EN, BUY_URL_FR: FR });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(`${FR}?prefilled_promo_code=LAUNCH`);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('treats any other lang as English', async () => {
    const res = await buy('/api/buy?lang=de', { BUY_URL_EN: EN, BUY_URL_FR: FR });
    expect(res.headers.get('location')).toBe(`${EN}?prefilled_promo_code=LAUNCH`);
  });

  it('keeps parameters already on the configured link and sets the promo code once', async () => {
    const res = await buy('/api/buy', { BUY_URL_EN: `${EN}?locale=en&prefilled_promo_code=OLD` });
    const location = new URL(res.headers.get('location')!);
    expect(location.origin + location.pathname).toBe(EN);
    expect(location.searchParams.get('locale')).toBe('en');
    expect(location.searchParams.getAll('prefilled_promo_code')).toEqual(['LAUNCH']);
  });

  it('falls back to the homepage download section in each language while a link is unset', async () => {
    const en = await buy('/api/buy', {});
    expect(en.status).toBe(302);
    expect(en.headers.get('location')).toBe('/#download');
    expect(en.headers.get('cache-control')).toBe('no-store');
    const fr = await buy('/api/buy?lang=fr', { BUY_URL_EN: EN });
    expect(fr.status).toBe(302);
    expect(fr.headers.get('location')).toBe('/fr/#download');
    expect(fr.headers.get('cache-control')).toBe('no-store');
  });

  it('never sends a buyer anywhere but an https link: anything else falls back', async () => {
    for (const bad of ['', '   ', 'not a url', 'http://buy.stripe.com/x', 'javascript:alert(1)']) {
      const res = await buy('/api/buy', { BUY_URL_EN: bad });
      expect(res.headers.get('location')).toBe('/#download');
    }
  });
});

it('is reachable at /buy and /buy/ through vercel.json rewrites to the function', async () => {
  const { readFile } = await import('node:fs/promises');
  const config = JSON.parse(await readFile(new URL('../../vercel.json', import.meta.url), 'utf8'));
  for (const source of ['/buy', '/buy/']) {
    expect(config.rewrites).toContainEqual({ source, destination: '/api/buy' });
  }
});
