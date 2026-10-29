// GET /api/download?token=: counts a start and redirects to a 60-second signed URL (Decision 2).
// Logic in src/server/gate.ts.
import { handleDownload } from '../src/server/gate.js';
import { gateDeps } from '../src/server/vercel.js';

export function GET(request: Request) {
  return handleDownload(request, gateDeps(request));
}
