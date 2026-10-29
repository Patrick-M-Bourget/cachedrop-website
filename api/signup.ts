// POST /api/signup: the /download/ form (Decision 1). Logic in src/server/gate.ts.
import { handleSignup } from '../src/server/gate.ts';
import { gateDeps } from '../src/server/vercel.ts';

export function POST(request: Request) {
  return handleSignup(request, gateDeps(request));
}
