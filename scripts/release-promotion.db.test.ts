import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { localEnvironment, PROJECTS } from './stage-release.ts';

describe.skipIf(process.env.DB_TESTS !== 'dev')('release promotion RPCs on isolated dev database', () => {
  it('enforces increasing immutable releases and retryable appcast-last promotion in a rolled-back transaction', () => {
    const env = localEnvironment();
    expect(env.SUPABASE_URL).toBe(PROJECTS.dev);
    const database = new URL(env.SUPABASE_DEV_DB_URL!);
    expect(database.username).toContain('nyefnnwhnlyovpdmzxiw');
    const result = spawnSync('node_modules/.bin/supabase', ['db', 'query', '--db-url', database.toString(),
      '--file', 'scripts/fixtures/release-promotion.sql'], { encoding: 'utf8' });
    // Never echo connection output: the CLI receives the DB credential without logging it.
    expect(result.status, 'Dev RPC transaction failed; check migration and fixture assertions.').toBe(0);
  }, 30000);
});
