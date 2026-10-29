import { test, expect, type Page } from '@playwright/test';

// Decision 19 (with 16 and 29): what the privacy policy must say. Each test reads the
// rendered page, the way a visitor would.

async function sectionText(page: Page, heading: string) {
  const section = page.locator('section', { has: page.getByRole('heading', { level: 2, name: heading }) });
  await expect(section).toHaveCount(1);
  return (await section.innerText()).replace(/\s+/g, ' ');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/privacy/');
});

test('names the person in charge and the privacy contact', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Privacy policy');
  const text = await sectionText(page, 'Who is responsible');
  expect(text).toContain('person in charge of the protection of personal information');
  expect(text).toContain('owner');
  await expect(page.getByRole('link', { name: 'privacy@cachedrop.io' }).first()).toHaveAttribute('href', 'mailto:privacy@cachedrop.io');
});

test('lists what is collected and why', async ({ page }) => {
  const text = await sectionText(page, 'What we collect and why');
  for (const item of [
    'Your email address',
    'What’s filling your Mac',
    'News emails',
    'Feedback',
    'System specs',
    'Page visits',
    'Download counts',
  ]) {
    expect(text, item).toContain(item);
  }
  expect(text).toContain('without cookies'); // Decision 16
});

test('says what Vercel Web Analytics records about a visit (Decision 16)', async ({ page }) => {
  const visits = (await page.locator('#collect li', { hasText: 'Page visits' }).innerText()).replace(/\s+/g, ' ');
  expect(visits).toContain('Vercel Web Analytics');
  for (const field of ['page you visit', 'site that sent you', 'country', 'browser', 'operating system', 'type of device']) {
    expect(visits, field).toContain(field);
  }
  expect(visits).toContain('without cookies');
  expect(visits).toContain('We remove the code from download links');
});

test('lists every provider and says which are outside Quebec', async ({ page }) => {
  const text = await sectionText(page, 'Who handles your information');
  for (const provider of ['Supabase', 'Vercel', 'Resend', 'Cloudflare', 'GitHub']) expect(text, provider).toContain(provider);
  // Decision 31 (amends 13): Supabase is in AWS US regions, so it is listed as outside Quebec.
  const supabase = (await page.locator('#providers li', { hasText: 'Supabase' }).innerText()).replace(/\s+/g, ' ');
  expect(supabase).toContain('Outside Quebec');
  expect(supabase).toContain('United States');
  expect(text).not.toContain('Montreal');
  expect(text).not.toMatch(/\bin Quebec\b/);
  expect(text).toContain('outside Quebec');
  expect(text).toContain('forwards email'); // Decision 29: Cloudflare Email Routing
  // Decision 30: the policy describes the launch state, where feedback issues are private.
  expect(text).toContain('private GitHub repository');
  expect(text).not.toMatch(/\bpublic\b/i);
});

test('states how long each kind of data is kept', async ({ page }) => {
  const text = await sectionText(page, 'How long we keep it');
  expect(text).toContain('until you unsubscribe or ask us to delete it');
  expect(text).toContain('30 days after');
  expect(text).toContain('with the feedback');
});

test('explains your rights, including a complaint to the CAI', async ({ page }) => {
  const text = await sectionText(page, 'Your rights');
  for (const right of ['see', 'correct', 'withdraw your consent', 'delete', 'Commission d’accès à l’information']) {
    expect(text, right).toContain(right);
  }
});

test('marks the mailing address as a placeholder (Decision 21)', async ({ page }) => {
  const placeholder = page.locator('[data-placeholder="mailing-address"]');
  await expect(placeholder).toBeVisible();
  await expect(placeholder).toContainText('placeholder');
});
