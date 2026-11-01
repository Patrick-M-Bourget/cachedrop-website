// POST /api/telemetry: the CacheDrop app's opt-in setup progress (Decision 38). Logic in src/server/telemetry.ts.
import { handleTelemetry } from '../src/server/telemetry.js';
import { telemetryDeps } from '../src/server/vercel.js';

export function POST(request: Request) {
  return handleTelemetry(request, telemetryDeps(request));
}
