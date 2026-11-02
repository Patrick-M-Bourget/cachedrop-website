// /buy (Decision 41): a temporary, uncached redirect to the Stripe Payment Link for the buyer's
// language, with the launch promo code. The links come from BUY_URL_EN and BUY_URL_FR in Vercel;
// while one is unset (or not an https URL) the buyer lands on the homepage's download section.
export interface BuyEnv { BUY_URL_EN?: string; BUY_URL_FR?: string }

const PROMO_CODE = 'LAUNCH';

function paymentLink(value: string | undefined): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

export function handleBuy(request: Request, env: BuyEnv): Response {
  const fr = new URL(request.url).searchParams.get('lang') === 'fr';
  const link = paymentLink(fr ? env.BUY_URL_FR : env.BUY_URL_EN);
  link?.searchParams.set('prefilled_promo_code', PROMO_CODE);
  const location = link?.href ?? (fr ? '/fr/#download' : '/#download');
  return new Response(null, { status: 302, headers: { location, 'cache-control': 'no-store' } });
}
