// Filing feedback as mac-cleaner issues through GitHub's REST API (Decisions 6, 8), and the test
// mode every non-production deployment uses, which never touches mac-cleaner (Decision 30: the
// repo is public until launch). The token is fine-grained: mac-cleaner only, Issues read and write.
import { marker, type IssueDraft, type Issues } from './feedback.js';

export const REPO = 'Patrick-M-Bourget/mac-cleaner';
const API = `https://api.github.com/repos/${REPO}/issues`;
const PAGE_SIZE = 100;
/** Feedback arrives a few a day; ten pages of issues is far more than one retry window holds. */
const MAX_PAGES = 10;

type Env = Record<string, string | undefined>;

/** mac-cleaner's issues for this deployment: real in production, test mode everywhere else. */
export function issuesFor(env: Env, fetch: typeof globalThis.fetch): Issues {
  if (env.VERCEL_ENV !== 'production') return { create: async (draft) => ({ captured: draft }), findByFeedbackId: async () => null };
  return githubIssues(env.GITHUB_FEEDBACK_TOKEN, fetch);
}

/** The real thing. */
export function githubIssues(token: string | undefined, fetch: typeof globalThis.fetch): Issues {
  async function call(url: string, init: RequestInit = {}) {
    if (!token) throw new Error('GITHUB_FEEDBACK_TOKEN is not set');
    const res = await fetch(url, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'user-agent': 'cachedrop-website',
        ...(init.body ? { 'content-type': 'application/json' } : {}),
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
    return res.json();
  }

  return {
    async create(draft: IssueDraft) {
      const issue = await call(API, { method: 'POST', body: JSON.stringify(draft) });
      return { number: issue.number as number };
    },

    async findByFeedbackId(id: number, since: string) {
      // `since` is a row's creation time; a minute earlier allows for clock skew. The list is
      // filtered by last update, so every issue filed after the row is in it.
      const from = new Date(Date.parse(since) - 60_000).toISOString();
      const line = marker(id);
      for (let page = 1; page <= MAX_PAGES; page++) {
        const query = new URLSearchParams({ labels: 'feedback', state: 'all', since: from, per_page: String(PAGE_SIZE), page: String(page) });
        const issues: Array<{ number: number; body: string | null }> = await call(`${API}?${query}`);
        const found = issues.find((i) => i.body?.split('\n')[0] === line);
        if (found) return found.number;
        if (issues.length < PAGE_SIZE) return null;
      }
      throw new Error(`more than ${MAX_PAGES * PAGE_SIZE} feedback issues since ${from}; not filing feedback ${id} blind`);
    },
  };
}
