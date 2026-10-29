// GET /api/release?token=: what the token page shows (Decision 15). Logic in src/server/gate.ts.
import { handleRelease } from '../src/server/gate.js';
import { gateDeps } from '../src/server/vercel.js';

export function GET(request: Request) {
  return handleRelease(request, gateDeps(request));
}
