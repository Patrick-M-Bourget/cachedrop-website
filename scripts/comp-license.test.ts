import { describe, expect, it } from 'vitest';
import { adminSecret, compLicense, parseArgs } from './comp-license.ts';
import { PROJECTS } from './stage-release.ts';

const ID = '6a1f3c2e-8b4d-4e5f-9a0b-1c2d3e4f5a6b';

describe('comp-license (Decision 45)', () => {
  it('reads the target, address and options, and picks a new ID unless one is given', () => {
    expect(parseArgs(['dev', 'a@example.com'], () => ID)).toEqual({ target: 'dev', email: 'a@example.com', lang: 'en', id: ID });
    expect(parseArgs(['prod', 'a@example.com', '--lang', 'fr', '--note', 'beta tester', '--id', 'x'], () => ID))
      .toEqual({ target: 'prod', email: 'a@example.com', lang: 'fr', note: 'beta tester', id: 'x' });
    for (const bad of [[], ['staging', 'a@example.com'], ['dev'], ['dev', '--lang'], ['dev', 'a@example.com', '--lang', 'de'], ['dev', 'a@example.com', '--note']]) {
      expect(() => parseArgs(bad)).toThrow(/usage/);
    }
  });

  it('takes the dev secret from .env.local and the prod one only from the shell', () => {
    expect(adminSecret('dev', { LICENSE_ADMIN_SECRET: 'shell' }, { LICENSE_ADMIN_SECRET: 'local' })).toBe('local');
    expect(adminSecret('prod', { LICENSE_ADMIN_SECRET: 'shell' }, { LICENSE_ADMIN_SECRET: 'local' })).toBe('shell');
    expect(() => adminSecret('prod', {}, { LICENSE_ADMIN_SECRET: 'local' })).toThrow(/in your shell/);
  });

  it('posts to the target project and reports each answer in one line', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const answer = (status: number, body: unknown) => (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify(body), { status });
    }) as unknown as typeof fetch;
    const request = { target: 'dev' as const, id: ID, email: 'a@example.com', lang: 'fr' as const, note: 'beta' };

    expect(await compLicense(request, 'secret', answer(200, { ok: true, id: ID }))).toBe(`Sent a free license to a@example.com (license ${ID}).`);
    expect(calls[0].url).toBe(`${PROJECTS.dev}/functions/v1/license/comp`);
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe('Bearer secret');
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ id: ID, email: 'a@example.com', lang: 'fr', note: 'beta' });

    expect(await compLicense(request, 's', answer(200, { ok: true, repeat: true }))).toMatch(/^Already sent/);
    await expect(compLicense(request, 's', answer(401, {}))).rejects.toThrow(/refused LICENSE_ADMIN_SECRET/);
    await expect(compLicense(request, 's', answer(409, {}))).rejects.toThrow(/without --id/);
    await expect(compLicense(request, 's', answer(502, { error: 'email_failed' }))).rejects.toThrow(`Not sent (502 email_failed). Run it again with --id ${ID}`);
    const offline = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    await expect(compLicense(request, 's', offline)).rejects.toThrow(`--id ${ID}`);
  });
});
