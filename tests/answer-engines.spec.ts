import { test, expect } from '@playwright/test';

// #94 (Decision 48): the site is open to AI answer engines, and says so by name.
const aiCrawlers = ['GPTBot', 'OAI-SearchBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended'];

/** robots.txt as groups: the user agents a group names and its rules (RFC 9309). */
function robotsGroups(text: string) {
  const groups: Array<{ agents: string[]; rules: string[] }> = [];
  let open = false;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) continue;
    const [key, ...rest] = line.split(':');
    const field = key.trim().toLowerCase();
    const value = rest.join(':').trim();
    if (field === 'user-agent') {
      if (!open) groups.push({ agents: [], rules: [] });
      groups.at(-1)!.agents.push(value);
      open = true;
    } else {
      if (field === 'allow' || field === 'disallow') groups.at(-1)?.rules.push(`${field}: ${value}`);
      open = false;
    }
  }
  return groups;
}

test('robots.txt allows every crawler, naming each AI crawler', async ({ request }) => {
  const response = await request.get('/robots.txt');
  expect(response.ok()).toBe(true);
  const text = await response.text();
  const groups = robotsGroups(text);
  for (const agent of ['*', ...aiCrawlers]) {
    const group = groups.filter((g) => g.agents.includes(agent));
    expect(group, agent).toHaveLength(1);
    expect(group[0].rules, agent).toEqual(['allow: /']);
  }
  expect(text).toContain('Sitemap: https://cachedrop.io/sitemap.xml');
});
