import { describe, expect, it } from 'vitest';
import { handleFeedback, retryFeedback, type FeedbackDb, type IssueDraft, type Issues } from './feedback.ts';

const SITE = 'https://preview.example.vercel.app';

type Row = {
  id: number;
  rating: string | null;
  email: string | null;
  message: string;
  page: string;
  specs: Record<string, string> | null;
  issue_number: number | null;
  created_at: string;
};

// An in-memory stand-in for the slice of supabase-js the feedback functions use, behaving like the
// feedback migration: save_feedback returns the new id, set_feedback_issue only fills an empty
// issue number, feedback_without_issue lists rows older than a time that still have none.
function fakeSupabase() {
  const rows: Row[] = [];
  const state = { rows, now: Date.parse('2026-10-29T12:00:00Z'), fail: false, failWriteBack: false };
  const db: FeedbackDb = {
    async rpc(fn: string, args: Record<string, unknown>) {
      if (state.fail) return { data: null, error: { message: 'connection reset' } };
      if (fn === 'save_feedback') {
        const a = args as { p_rating: string | null; p_email: string | null; p_message: string; p_page: string; p_specs: Row['specs'] };
        const row: Row = {
          id: rows.length + 1,
          rating: a.p_rating,
          email: a.p_email,
          message: a.p_message,
          page: a.p_page,
          specs: a.p_specs,
          issue_number: null,
          created_at: new Date(state.now).toISOString(),
        };
        rows.push(row);
        return { data: row.id, error: null };
      }
      if (fn === 'set_feedback_issue') {
        if (state.failWriteBack) return { data: null, error: { message: 'timeout' } };
        const { p_id, p_issue_number } = args as { p_id: number; p_issue_number: number };
        const row = rows.find((r) => r.id === p_id);
        if (row && row.issue_number === null) row.issue_number = p_issue_number;
        return { data: null, error: null };
      }
      if (fn === 'feedback_without_issue') {
        const { p_created_before, p_limit } = args as { p_created_before: string; p_limit: number };
        const due = rows.filter((r) => r.issue_number === null && r.created_at < p_created_before).slice(0, p_limit);
        return { data: due.map(({ email: _email, issue_number: _n, ...r }) => ({ ...r, has_email: _email !== null })), error: null };
      }
      throw new Error(`unexpected rpc ${fn}`);
    },
  } as FeedbackDb;
  return { db, state };
}

// GitHub as the handlers see it. The real client (github.ts) has its own tests against fetch.
function fakeGitHub() {
  const created: Array<IssueDraft & { number: number }> = [];
  const state = { created, fail: false };
  const issues: Issues = {
    async create(draft) {
      if (state.fail) throw new Error('GitHub answered 502');
      const issue = { ...draft, number: 100 + created.length };
      created.push(issue);
      return { number: issue.number };
    },
    async findByFeedbackId(id) {
      return created.find((i) => i.body.includes(`<!-- cachedrop-feedback:${id} -->`))?.number ?? null;
    },
  };
  return { issues, state };
}

function setup() {
  const supabase = fakeSupabase();
  const github = fakeGitHub();
  const deps = { db: supabase.db, issues: github.issues, now: () => supabase.state.now };
  return { db: supabase.state, github: github.state, deps };
}

const post = (body: unknown, headers: Record<string, string> = { 'content-type': 'application/json' }) =>
  new Request(`${SITE}/api/feedback`, { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) });

const SPECS = { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', language: 'en-CA' };
const FULL = { rating: 'happy', email: 'ada@example.com', message: 'The scan found 40 GB of DerivedData.', page: '/', specs: SPECS };

describe('feedback (POST /api/feedback)', () => {
  it('saves one row and creates one issue labelled feedback and needs-triage, then stores its number', async () => {
    const { deps, db, github } = setup();
    const res = await handleFeedback(post(FULL), deps);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(db.rows).toHaveLength(1);
    expect(db.rows[0]).toMatchObject({ rating: 'happy', email: 'ada@example.com', message: FULL.message, page: '/', specs: SPECS });
    expect(github.created).toHaveLength(1);
    expect(github.created[0].labels).toEqual(['feedback', 'needs-triage']);
    expect(db.rows[0].issue_number).toBe(github.created[0].number);
  });

  it('never puts the email in the issue, even one typed into the message', async () => {
    const { deps, github } = setup();
    await handleFeedback(post({ ...FULL, message: 'Reach me at ada@example.com' }), deps);
    await handleFeedback(post(FULL), deps);
    for (const issue of github.created) {
      expect(issue.title).not.toContain('ada@example.com');
      expect(issue.body).not.toContain('ada@example.com');
    }
    expect(github.created[0].body).toContain('> Reach me at [email removed]');
  });
});

describe('the issue', () => {
  const issue = async (feedback: Record<string, unknown>) => {
    const { deps, github } = setup();
    await handleFeedback(post(feedback), deps);
    return github.created[0];
  };

  it('is titled with the rating and the start of the message', async () => {
    expect((await issue(FULL)).title).toBe('Happy: The scan found 40 GB of DerivedData.');
    const long = await issue({
      ...FULL,
      rating: 'angry',
      message: 'It deleted nothing.\nThen it hung for ten minutes on the Docker scan and I had to quit it twice',
    });
    expect(long.title).toBe('Very unhappy: It deleted nothing. Then it hung for ten minutes on the Docker…');
    expect((await issue({ ...FULL, message: '' })).title).toBe('Happy (no message)');
    expect((await issue({ ...FULL, rating: null })).title).toBe('No rating: The scan found 40 GB of DerivedData.');
  });

  it('holds the rating, message, page and specs, in the format the triage routine reads', async () => {
    const { body } = await issue({ ...FULL, page: '/clear-mac-developer-caches/' });
    expect(body).toBe(
      [
        '<!-- cachedrop-feedback:1 -->',
        '**Rating:** Happy 🙂',
        '**Page:** `/clear-mac-developer-caches/`',
        '**Email:** given (stored with feedback 1, not shown here)',
        '',
        '**Message**',
        '',
        '> The scan found 40 GB of DerivedData.',
        '',
        '**System specs**',
        '',
        '```text',
        'User agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        'Platform: MacIntel',
        'Language: en-CA',
        '```',
        '',
        '<sub>Sent from the cachedrop.io feedback form.</sub>',
      ].join('\n'),
    );
  });

  it('says what was left out', async () => {
    const { body } = await issue({ rating: null, email: '', message: 'Hi', page: '/', specs: null });
    expect(body).toContain('**Rating:** none');
    expect(body).toContain('**Email:** not given');
    expect(body).toContain('**System specs:** not sent');
    expect(body).not.toContain('```');
  });

  it('quotes the message so its Markdown stays inside the quote and pings nobody', async () => {
    const message = '# Big heading\n\n</details><img src=x>\n```\nunclosed fence\n@octocat look at owner/repo#12 and #3';
    const { body, title } = await issue({ ...FULL, message });
    const quoted = body.split('**Message**\n\n')[1].split('\n\n**System specs**')[0];
    for (const line of quoted.split('\n')) expect(line).toMatch(/^>( |$)/);
    expect(quoted).toContain('&lt;/details>&lt;img src=x>');
    expect(body).not.toMatch(/@octocat|#12|#3\b/);
    expect(title).not.toMatch(/@octocat/);
  });

  it('keeps the specs block closed whatever the browser reports', async () => {
    const { body } = await issue({ ...FULL, specs: { ...SPECS, userAgent: 'evil ``` # injected ````' } });
    const fence = body.match(/\n(`{3,})text\n/)![1];
    expect(fence.length).toBeGreaterThan(4);
    expect(body).toContain(`\n${fence}\n\n<sub>`);
  });
});

describe('validation', () => {
  const bad: Array<[string, unknown]> = [
    ['an unknown rating', { ...FULL, rating: 'ecstatic' }],
    ['no rating and no message', { ...FULL, rating: null, message: '   ' }],
    ['a malformed email', { ...FULL, email: 'ada@' }],
    ['an email over 254 characters', { ...FULL, email: `${'a'.repeat(250)}@example.com` }],
    ['a message over 5000 characters', { ...FULL, message: 'a'.repeat(5001) }],
    ['a message that is not text', { ...FULL, message: ['hi'] }],
    ['a page that is not a path', { ...FULL, page: 'https://evil.example/' }],
    ['a page with Markdown in it', { ...FULL, page: '/`x`/' }],
    ['a page over 200 characters', { ...FULL, page: `/${'a'.repeat(200)}` }],
    ['specs with an extra field', { ...FULL, specs: { ...SPECS, model: 'MacBookPro18,1' } }],
    ['specs missing a field', { ...FULL, specs: { userAgent: 'x', platform: 'MacIntel' } }],
    ['specs that are not text', { ...FULL, specs: { ...SPECS, language: 3 } }],
    ['specs with a line break', { ...FULL, specs: { ...SPECS, platform: 'Mac\nIntel' } }],
    ['a user agent over 512 characters', { ...FULL, specs: { ...SPECS, userAgent: 'a'.repeat(513) } }],
    ['an array', [FULL]],
    ['null', null],
  ];

  it.each(bad)('refuses %s without saving or filing anything', async (_, body) => {
    const { deps, db, github } = setup();
    const res = await handleFeedback(post(body), deps);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid' });
    expect(db.rows).toEqual([]);
    expect(github.created).toEqual([]);
  });

  it('refuses a body that is not JSON', async () => {
    const { deps, db } = setup();
    expect((await handleFeedback(post('rating=happy'), deps)).status).toBe(400);
    expect(db.rows).toEqual([]);
  });

  it('refuses an oversized body', async () => {
    const { deps, db } = setup();
    const res = await handleFeedback(post({ ...FULL, padding: 'x'.repeat(40_000) }), deps);
    expect(res.status).toBe(413);
    expect(db.rows).toEqual([]);
  });

  it('accepts the smallest submissions the modal sends: a rating alone, or a message alone', async () => {
    const { deps, db } = setup();
    expect((await handleFeedback(post({ rating: 'love', email: '', message: '', page: '/', specs: null }), deps)).status).toBe(200);
    expect((await handleFeedback(post({ rating: null, email: '', message: 'Hi', page: '/', specs: null }), deps)).status).toBe(200);
    expect(db.rows.map((r) => [r.rating, r.email, r.message, r.specs])).toEqual([
      ['love', null, '', null],
      [null, null, 'Hi', null],
    ]);
  });

  it('stores the email trimmed and lower-cased, and the message trimmed', async () => {
    const { deps, db } = setup();
    await handleFeedback(post({ ...FULL, email: '  Ada@Example.COM ', message: '  Hello  \n' }), deps);
    expect(db.rows[0]).toMatchObject({ email: 'ada@example.com', message: 'Hello' });
  });
});

describe('when something fails', () => {
  it('files nothing and says so when the database is unavailable', async () => {
    const { deps, db, github } = setup();
    db.fail = true;
    const res = await handleFeedback(post(FULL), deps);
    expect(res.status).toBe(503);
    expect(github.created).toEqual([]);
  });

  it('still thanks the person when GitHub fails: the row is saved for the retry', async () => {
    const { deps, db, github } = setup();
    github.fail = true;
    const res = await handleFeedback(post(FULL), deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(db.rows).toHaveLength(1);
    expect(db.rows[0].issue_number).toBeNull();
  });

  it('never names the repository or GitHub in a response', async () => {
    const { deps, db, github } = setup();
    github.fail = true;
    const texts = [await (await handleFeedback(post(FULL), deps)).text()];
    db.fail = true;
    texts.push(await (await handleFeedback(post(FULL), deps)).text());
    texts.push(await (await handleFeedback(post({ ...FULL, rating: 'x' }), deps)).text());
    for (const text of texts) expect(text).not.toMatch(/github|mac-cleaner|issue/i);
  });
});

describe('test mode (previews)', () => {
  it('files nothing and returns the issue it would have filed', async () => {
    const { deps, db } = setup();
    const issues: Issues = { create: async (draft) => ({ captured: draft }), findByFeedbackId: async () => null };
    const res = await handleFeedback(post(FULL), { ...deps, issues });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.captured.labels).toEqual(['feedback', 'needs-triage']);
    expect(body.captured.title).toBe('Happy: The scan found 40 GB of DerivedData.');
    expect(db.rows).toHaveLength(1);
    expect(db.rows[0].issue_number).toBeNull();
  });
});

const MINUTE = 60 * 1000;
const CRON = { authorization: 'Bearer cron-secret' };
const cron = (headers: Record<string, string> = CRON) => new Request(`${SITE}/api/feedback-retry`, { headers });

describe('the retry (GET /api/feedback-retry, daily cron)', () => {
  async function failedOnce() {
    const s = setup();
    s.github.fail = true;
    await handleFeedback(post(FULL), s.deps);
    s.github.fail = false;
    s.db.now += 11 * MINUTE;
    return { ...s, deps: { ...s.deps, cronSecret: 'cron-secret' } };
  }

  it('files the issue for a row GitHub refused, exactly once across runs', async () => {
    const { deps, db, github } = await failedOnce();
    const first = await retryFeedback(cron(), deps);
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ filed: 1, linked: 0, failed: 0 });
    await retryFeedback(cron(), deps);
    expect(github.created).toHaveLength(1);
    expect(github.created[0].labels).toEqual(['feedback', 'needs-triage']);
    expect(github.created[0].body).toContain('**Email:** given (stored with feedback 1, not shown here)');
    expect(github.created[0].body).not.toContain('ada@example.com');
    expect(db.rows[0].issue_number).toBe(github.created[0].number);
  });

  it('files the same issue the submission would have', async () => {
    const { deps, github } = await failedOnce();
    await retryFeedback(cron(), deps);
    const direct = setup();
    await handleFeedback(post(FULL), direct.deps);
    expect(github.created[0]).toEqual(direct.github.created[0]);
  });

  it('leaves rows under 10 minutes old to the submission still filing them', async () => {
    const { deps, db, github } = await failedOnce();
    db.now -= 2 * MINUTE;
    expect(await (await retryFeedback(cron(), deps)).json()).toEqual({ filed: 0, linked: 0, failed: 0 });
    expect(github.created).toEqual([]);
  });

  it('links the issue instead of filing a second one when only the write-back failed', async () => {
    const s = setup();
    s.db.failWriteBack = true;
    await handleFeedback(post(FULL), s.deps);
    s.db.failWriteBack = false;
    s.db.now += 11 * MINUTE;
    const res = await retryFeedback(cron(), { ...s.deps, cronSecret: 'cron-secret' });
    expect(await res.json()).toEqual({ filed: 0, linked: 1, failed: 0 });
    expect(s.github.created).toHaveLength(1);
    expect(s.db.rows[0].issue_number).toBe(s.github.created[0].number);
  });

  it('keeps the row for the next run and reports failure while GitHub is still down', async () => {
    const { deps, db, github } = await failedOnce();
    github.fail = true;
    const res = await retryFeedback(cron(), deps);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ filed: 0, linked: 0, failed: 1 });
    expect(db.rows[0].issue_number).toBeNull();
  });

  it.each([
    ['no authorization', {}],
    ['the wrong secret', { authorization: 'Bearer nope' }],
  ])('refuses a request with %s', async (_, headers) => {
    const { deps, github } = await failedOnce();
    expect((await retryFeedback(cron(headers), deps)).status).toBe(401);
    expect(github.created).toEqual([]);
  });

  it('refuses everything when no cron secret is configured', async () => {
    const { deps, github } = await failedOnce();
    expect((await retryFeedback(cron({ authorization: 'Bearer ' }), { ...deps, cronSecret: undefined })).status).toBe(401);
    expect((await retryFeedback(cron({ authorization: 'Bearer undefined' }), { ...deps, cronSecret: undefined })).status).toBe(401);
    expect(github.created).toEqual([]);
  });
});
