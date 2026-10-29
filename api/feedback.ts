// POST /api/feedback: the feedback modal on every page (Decision 6). Logic in src/server/feedback.ts.
import { handleFeedback } from '../src/server/feedback.js';
import { feedbackDeps } from '../src/server/vercel.js';

export function POST(request: Request) {
  return handleFeedback(request, feedbackDeps());
}
