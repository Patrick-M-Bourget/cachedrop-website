import { describe, expect, it } from 'vitest';
import { isTestDeployment } from './shared.ts';

describe('isTestDeployment', () => {
  it.each([['preview'], ['development']])('is true on %s', (env) => {
    expect(isTestDeployment({ VERCEL_ENV: env })).toBe(true);
  });

  it.each([['production'], [undefined], [''], ['Preview'], ['staging']])('fails closed on %s', (env) => {
    expect(isTestDeployment({ VERCEL_ENV: env })).toBe(false);
  });
});
