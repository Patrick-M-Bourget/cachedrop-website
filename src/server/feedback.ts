// The feedback loop (Decisions 6, 8, 10): the request handler behind api/feedback. It saves the
// feedback in Supabase, then files it as a mac-cleaner issue. Supabase and GitHub come in as
// dependencies, so Vitest can stand in for both at the boundary (Decision 27).
import { createHash, timingSafeEqual } from 'node:crypto';
import { guard, type Guard } from './bot-check.js';
import { EMAIL, json, type Result } from './shared.js';

export const RATINGS = ['angry', 'meh', 'neutral', 'happy', 'love'] as const;
export type Rating = (typeof RATINGS)[number];
export type Specs = { userAgent: string; platform: string; language: string };

/** The slice of the supabase-js client the feedback functions use. */
export interface FeedbackDb {
  rpc(
    fn: 'save_feedback',
    args: { p_rating: Rating | null; p_email: string | null; p_message: string; p_page: string; p_specs: Specs | null },
  ): Result<number>;
  rpc(fn: 'set_feedback_issue', args: { p_id: number; p_issue_number: number }): Result<unknown>;
  rpc(fn: 'feedback_without_issue', args: { p_created_before: string; p_limit: number }): Result<PendingRow[]>;
  rpc(...args: Parameters<Guard['db']['rpc']>): Result<number>;
}

/** A saved row still waiting for its issue, as feedback_without_issue returns it (no email). */
export type PendingRow = {
  id: number;
  rating: Rating | null;
  has_email: boolean;
  message: string;
  page: string;
  specs: Specs | null;
  created_at: string;
};

export interface IssueDraft {
  title: string;
  body: string;
  labels: string[];
}

/** mac-cleaner's issues, as the feedback functions need them. */
export interface Issues {
  /** Files the issue. In test mode it returns the draft instead of filing it. */
  create(draft: IssueDraft): Promise<{ number: number } | { captured: IssueDraft }>;
  /** The issue already filed for this feedback row, if any, looking at issues since `since`. */
  findByFeedbackId(id: number, since: string): Promise<number | null>;
}

export interface FeedbackDeps {
  db: FeedbackDb;
  issues: Issues;
}

/** Submitting also runs the bot check and rate limit (Decision 12). */
export type SubmitDeps = FeedbackDeps & Guard;

export interface RetryDeps extends FeedbackDeps {
  /** Vercel Cron sends it as a bearer token. Unset refuses every request. */
  cronSecret: string | undefined;
  now(): number;
}

/** What an issue is made from: everything but the email, which only Supabase holds (Decision 9). */
export interface Feedback {
  id: number;
  rating: Rating | null;
  hasEmail: boolean;
  message: string;
  page: string;
  specs: Specs | null;
}

export const LABELS = ['feedback', 'needs-triage'];
const RATING_NAMES: Record<Rating, string> = { angry: 'Very unhappy', meh: 'Unhappy', neutral: 'Neutral', happy: 'Happy', love: 'Love it' };
const RATING_EMOJI: Record<Rating, string> = { angry: '😡', meh: '😕', neutral: '😐', happy: '🙂', love: '😍' };
const TITLE_SNIPPET = 64;
/** The hidden line that ties an issue to its row, so the retry can find an issue it already filed. */
export const marker = (id: number) => `<!-- cachedrop-feedback:${id} -->`;

const EMAIL_IN_TEXT = /[^\s@<>()[\]]+@[^\s@<>()[\]]+\.[A-Za-z]{2,}/g;

/**
 * Makes reporter text safe to show in an issue: no email addresses, no @mentions that would notify
 * someone, and no issue references that would post a backlink elsewhere. A zero-width space after
 * the @ or # keeps the text readable.
 */
function defuse(text: string) {
  return text
    .replace(EMAIL_IN_TEXT, '[email removed]')
    .replace(/@(?=[A-Za-z0-9])/g, '@​')
    .replace(/#(?=\d)/g, '#​');
}

function title(f: Feedback) {
  const rating = f.rating ? RATING_NAMES[f.rating] : 'No rating';
  const text = defuse(f.message).replace(/\s+/g, ' ').trim();
  if (!text) return `${rating} (no message)`;
  if (text.length <= TITLE_SNIPPET) return `${rating}: ${text}`;
  const cut = text.slice(0, TITLE_SNIPPET + 1);
  const space = cut.lastIndexOf(' ');
  return `${rating}: ${(space > 0 ? cut.slice(0, space) : cut.slice(0, TITLE_SNIPPET)).trimEnd()}…`;
}

/** A Markdown blockquote: the message's own Markdown renders, but can't leave the quote. */
const quote = (text: string) =>
  defuse(text)
    .replace(/</g, '&lt;')
    .split(/\r\n|\r|\n/)
    .map((line) => (line ? `> ${line}` : '>'))
    .join('\n');

/** A code fence longer than any run of backticks inside it. */
function fenced(text: string) {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const fence = '`'.repeat(Math.max(3, longest + 1));
  return `${fence}text\n${text}\n${fence}`;
}

/** The issue for one piece of feedback: rating, message, page and specs. Never the email. */
export function issueFor(f: Feedback): IssueDraft {
  const lines = [
    marker(f.id),
    `**Rating:** ${f.rating ? `${RATING_NAMES[f.rating]} ${RATING_EMOJI[f.rating]}` : 'none'}`,
    `**Page:** \`${redactPage(f.page)}\``,
    `**Email:** ${f.hasEmail ? `given (stored with feedback ${f.id}, not shown here)` : 'not given'}`,
    '',
  ];
  lines.push(...(f.message ? ['**Message**', '', quote(f.message)] : ['**Message:** none']), '');
  if (f.specs) {
    const specs = `User agent: ${f.specs.userAgent}\nPlatform: ${f.specs.platform}\nLanguage: ${f.specs.language}`;
    lines.push('**System specs**', '', fenced(specs));
  } else {
    lines.push('**System specs:** not sent');
  }
  lines.push('', '<sub>Sent from the cachedrop.io feedback form.</sub>');
  return { title: title(f), body: lines.join('\n'), labels: LABELS };
}

/** Limits the modal's fields stay within (the textarea and email input carry the same maxlength). */
export const MAX_MESSAGE = 5000;
export const MAX_EMAIL = 254;
const MAX_PAGE = 200;
const MAX_SPEC = { userAgent: 512, platform: 64, language: 35 } as const;
/** A full 5000-character message of 4-byte characters, plus the rest, fits; anything bigger is refused. */
const MAX_BODY_BYTES = 32 * 1024;

// A site path as location.pathname sends it: no scheme, no host, nothing that is Markdown.
const PAGE = /^\/[A-Za-z0-9\-._~/%]*$/;
// A token page, /download/<token>/ or /fr/download/<token>/: the token is a live download link
// (Decision 2), so it is never stored or filed. site.js sends the redacted path already; this
// catches a request that doesn't.
const TOKEN_PAGE = /^(\/fr)?\/download\/[^/]+(\/.*)?$/;
const REDACTED_PAGE = /^(\/fr)?\/download\/\[token\]\/$/;
/** The page with any download token swapped for [token]. */
export const redactPage = (page: string) => page.replace(TOKEN_PAGE, '$1/download/[token]/');
// Printable text on one line: no control characters.
const ONE_LINE = /^[^\p{Cc}]*$/u;

type Submission = { rating: Rating | null; email: string | null; message: string; page: string; specs: Specs | null };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function parseSpecs(value: unknown): Specs | null | undefined {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) return undefined;
  const keys = Object.keys(value).sort();
  if (keys.join() !== 'language,platform,userAgent') return undefined;
  for (const key of keys as Array<keyof Specs>) {
    const v = value[key];
    if (typeof v !== 'string' || v.length > MAX_SPEC[key] || !ONE_LINE.test(v)) return undefined;
  }
  return value as Specs;
}

/** The submission as handoff §3 defines it, or undefined when anything is off. */
function parse(body: unknown): Submission | undefined {
  if (!isRecord(body)) return undefined;
  const rating = body.rating === null || body.rating === undefined ? null : RATINGS.find((r) => r === body.rating);
  if (rating === undefined) return undefined;

  if (body.email !== undefined && body.email !== null && typeof body.email !== 'string') return undefined;
  const email = (body.email ?? '').trim().toLowerCase() || null;
  if (email !== null && (email.length > MAX_EMAIL || !EMAIL.test(email))) return undefined;

  if (body.message !== undefined && typeof body.message !== 'string') return undefined;
  const message = (body.message ?? '').trim();
  if (message.length > MAX_MESSAGE || (!message && !rating)) return undefined;

  if (typeof body.page !== 'string' || body.page.length > MAX_PAGE) return undefined;
  const page = redactPage(body.page);
  if (!PAGE.test(page) && !REDACTED_PAGE.test(page)) return undefined;

  const specs = parseSpecs(body.specs);
  if (specs === undefined) return undefined;
  return { rating, email, message, page, specs };
}

/**
 * POST /api/feedback with JSON `{ rating, email, message, page, specs, turnstile }` (handoff §3).
 * The Turnstile token and the rate limit are checked before anything is saved (Decision 12).
 */
export async function handleFeedback(request: Request, deps: SubmitDeps): Promise<Response> {
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) return json({ error: 'too_large' }, 413);
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return json({ error: 'too_large' }, 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'invalid' }, 400);
  }
  const f = parse(body);
  if (!f) return json({ error: 'invalid' }, 400);
  const refused = await guard('feedback', (body as { turnstile?: unknown }).turnstile, deps);
  if (refused) return refused;

  const saved = await deps.db.rpc('save_feedback', {
    p_rating: f.rating,
    p_email: f.email,
    p_message: f.message,
    p_page: f.page,
    p_specs: f.specs,
  });
  if (saved.error || typeof saved.data !== 'number') return json({ error: 'unavailable' }, 503);
  const id = saved.data;

  // The feedback is safe in Supabase from here on, so the person gets their thanks whatever
  // GitHub does; the retry files whatever this couldn't.
  try {
    const filed = await deps.issues.create(issueFor({ id, ...f, hasEmail: f.email !== null }));
    if ('captured' in filed) return json({ ok: true, captured: filed.captured });
    await writeBack(deps.db, id, filed.number);
  } catch (e) {
    console.error(`feedback ${id}: issue not filed, the retry will:`, (e as Error).message);
  }
  return json({ ok: true });
}

async function writeBack(db: FeedbackDb, id: number, issueNumber: number) {
  const { error } = await db.rpc('set_feedback_issue', { p_id: id, p_issue_number: issueNumber });
  if (error) throw new Error(`issue ${issueNumber} filed, but not stored: ${error.message}`);
}

/** Rows younger than this may still be filing their issue in the submitting request. */
const RETRY_AFTER_MS = 10 * 60 * 1000;
/** Keeps one run well inside a function's time limit; the next run takes the rest. */
const RETRY_BATCH = 25;

const sha256 = (s: string) => createHash('sha256').update(s).digest();
const sameSecret = (a: string, b: string) => timingSafeEqual(sha256(a), sha256(b));

/**
 * GET /api/feedback-retry, run daily by Vercel Cron with `Authorization: Bearer $CRON_SECRET`.
 * Files the issue for each row that has none (Decision 6). A row whose issue was filed but whose
 * number wasn't stored gets that issue linked, so no feedback is filed twice.
 */
export async function retryFeedback(request: Request, deps: RetryDeps): Promise<Response> {
  const secret = deps.cronSecret;
  if (!secret || !sameSecret(request.headers.get('authorization') ?? '', `Bearer ${secret}`)) {
    return json({ error: 'unauthorized' }, 401);
  }
  const before = new Date(deps.now() - RETRY_AFTER_MS).toISOString();
  const { data, error } = await deps.db.rpc('feedback_without_issue', { p_created_before: before, p_limit: RETRY_BATCH });
  if (error || !data) return json({ error: 'unavailable' }, 503);

  const result = { filed: 0, linked: 0, failed: 0 };
  for (const row of data) {
    try {
      const existing = await deps.issues.findByFeedbackId(row.id, row.created_at);
      if (existing !== null) {
        await writeBack(deps.db, row.id, existing);
        result.linked++;
        continue;
      }
      const filed = await deps.issues.create(
        issueFor({ id: row.id, rating: row.rating, hasEmail: row.has_email, message: row.message, page: row.page, specs: row.specs }),
      );
      if ('captured' in filed) continue; // test mode: nothing to store
      await writeBack(deps.db, row.id, filed.number);
      result.filed++;
    } catch (e) {
      console.error(`feedback ${row.id}: retry failed:`, (e as Error).message);
      result.failed++;
    }
  }
  return json(result, result.failed ? 502 : 200);
}
