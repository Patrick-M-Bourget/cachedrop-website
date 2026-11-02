// /buy and /buy?lang=fr (vercel.json rewrites them here): the Stripe Payment Link redirect
// (Decision 41). Logic in src/server/buy.ts.
import { handleBuy } from '../src/server/buy.ts';

export function GET(request: Request) {
  return handleBuy(request, process.env);
}
