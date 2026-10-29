// /api/unsubscribe?token=: the List-Unsubscribe one-click POST, and the POST the /unsubscribe/
// page makes (Decision 4). A GET goes to that page. Logic in src/server/unsubscribe.ts.
import { handleUnsubscribe } from '../src/server/unsubscribe.js';
import { gateDeps } from '../src/server/vercel.js';

export function GET(request: Request) {
  return handleUnsubscribe(request, gateDeps(request));
}

export function POST(request: Request) {
  return handleUnsubscribe(request, gateDeps(request));
}
