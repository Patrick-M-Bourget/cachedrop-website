// GET /api/feedback-retry: Vercel Cron, daily (vercel.json). Files the issue for feedback rows
// that have none (Decision 6). Logic in src/server/feedback.ts.
import { retryFeedback } from '../src/server/feedback.js';
import { feedbackDeps } from '../src/server/vercel.js';

export function GET(request: Request) {
  return retryFeedback(request, feedbackDeps());
}
