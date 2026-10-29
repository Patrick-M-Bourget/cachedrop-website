import { test, expect } from '@playwright/test';

// The feedback modal end to end on a Vercel preview (Decision 27): modal → api/feedback → a row in
// the dev Supabase project. Previews are in test mode: the function files nothing in mac-cleaner
// and answers with the issue it would have filed, which this reads.
// Skipped unless PREVIEW_URL is set. Run it like tests/gate-journey.spec.ts:
//   vercel env run -- sh -c 'PREVIEW_URL=https://<preview> npx playwright test tests/feedback-journey.spec.ts'
const PREVIEW = process.env.PREVIEW_URL;
const OIDC = process.env.VERCEL_OIDC_TOKEN;

test.skip(!PREVIEW, 'set PREVIEW_URL to run the journey against a preview');

const protection = (): Record<string, string> => (OIDC ? { 'x-vercel-trusted-oidc-idp-token': OIDC } : {});

type Captured = { title: string; body: string; labels: string[] };

test('modal → saved → the issue it would file: labelled, with specs, without the email', async ({ page }) => {
  const origin = new URL(PREVIEW!).origin;
  const answers: Array<{ status: number; body: { ok?: boolean; captured?: Captured } }> = [];
  await page.route(
    (url) => url.origin === origin,
    async (route) => {
      const headers = { ...route.request().headers(), ...protection() };
      if (new URL(route.request().url()).pathname !== '/api/feedback') return route.continue({ headers });
      const response = await route.fetch({ headers });
      answers.push({ status: response.status(), body: await response.json() });
      return route.fulfill({ response });
    },
  );

  await page.goto('/clear-mac-developer-caches/');
  await page.locator('[data-feedback]').first().click();
  await page.getByRole('button', { name: 'Unhappy', exact: true }).click();
  const email = `feedback-journey+${Date.now()}@example.com`;
  await page.getByLabel('Email (optional)').fill(email);
  await page.getByLabel('What should we change?').fill('Journey test: the **scan** missed ~/Library/Caches. Reach me at ' + email);
  await page.getByRole('checkbox', { name: /Send anonymous system specs/ }).check();
  await page.getByRole('button', { name: 'Submit Feedback' }).click();
  await expect(page.getByText('Thanks, that helps.')).toBeVisible();

  expect(answers.map((a) => a.status)).toEqual([200]);
  const issue = answers[0].body.captured!;
  expect(issue.labels).toEqual(['feedback', 'needs-triage']);
  expect(issue.title).toBe('Unhappy: Journey test: the **scan** missed ~/Library/Caches. Reach me at…');
  expect(issue.body).toContain('**Rating:** Unhappy 😕');
  expect(issue.body).toContain('**Page:** `/clear-mac-developer-caches/`');
  expect(issue.body).toContain('> Journey test: the **scan** missed ~/Library/Caches. Reach me at [email removed]');
  expect(issue.body).toMatch(/\*\*Email:\*\* given \(stored with feedback \d+, not shown here\)/);
  expect(issue.body).toContain(`User agent: ${await page.evaluate(() => navigator.userAgent)}`);
  expect(`${issue.title}\n${issue.body}`).not.toContain(email);
});

test('the function refuses malformed and oversized payloads', async ({ request }) => {
  const post = (data: string) =>
    request.post('/api/feedback', { headers: { ...protection(), 'content-type': 'application/json' }, data });
  expect((await post(JSON.stringify({ rating: 'ecstatic', message: 'x', page: '/', specs: null }))).status()).toBe(400);
  expect((await post('not json')).status()).toBe(400);
  expect((await post(JSON.stringify({ rating: 'happy', message: 'x'.repeat(40_000), page: '/', specs: null }))).status()).toBe(413);
});

test('the retry refuses anyone but Vercel Cron', async ({ request }) => {
  expect((await request.get('/api/feedback-retry', { headers: protection() })).status()).toBe(401);
});
