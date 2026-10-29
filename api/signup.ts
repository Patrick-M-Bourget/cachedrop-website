// POST /api/signup: the /download/ form (Decision 1). Logic in src/server/gate.ts.
import { handleSignup } from '../src/server/gate.js';
import { signupDeps } from '../src/server/vercel.js';

export function POST(request: Request) {
  return handleSignup(request, signupDeps(request));
}
