import { describe, expect, it } from 'vitest';
import { handleAppcast } from './appcast.ts';

describe('canonical website appcast', () => {
  it('serves only the promoted feed with revalidated caching and ETag', async () => {
    const load = async () => ({ xml: '<rss/>', sha256: 'abc' });
    const response = await handleAppcast(new Request('https://preview.vercel.app/updates/appcast.xml'), load);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('<rss/>');
    expect(response.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate');
    expect(response.headers.get('etag')).toBe('"abc"');
    const unchanged = await handleAppcast(new Request('https://preview.vercel.app/updates/appcast.xml', {
      headers: { 'if-none-match': '"abc"' },
    }), load);
    expect(unchanged.status).toBe(304);
    expect(await unchanged.text()).toBe('');
  });
});

it('returns uncached not-found until promotion and unavailable on a database failure', async () => {
  const request = new Request('https://preview.vercel.app/updates/appcast.xml');
  const absent = await handleAppcast(request, async () => null);
  expect(absent.status).toBe(404);
  expect(absent.headers.get('cache-control')).toBe('no-store');
  const failed = await handleAppcast(request, async () => { throw new Error('private database details'); });
  expect(failed.status).toBe(503);
  expect(await failed.text()).not.toContain('private database details');
});
