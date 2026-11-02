import { describe, expect, it } from 'vitest';
import { missingMigrations } from './db-push-guard.ts';

describe('missingMigrations (#78)', () => {
  it('names every migration on origin/main that this checkout lacks', () => {
    const remote = ['supabase/migrations/20261030010000_release_promotion.sql', 'supabase/migrations/20261101180000_licenses.sql'];
    expect(missingMigrations(remote, ['20261030010000_release_promotion.sql'])).toEqual(['20261101180000_licenses.sql']);
  });

  it('is empty when the checkout holds all of them, extra local ones included', () => {
    const remote = ['supabase/migrations/a.sql'];
    expect(missingMigrations(remote, ['a.sql', 'b.sql'])).toEqual([]);
  });

  it('ignores anything that is not a .sql file', () => {
    expect(missingMigrations(['supabase/migrations/README.md'], [])).toEqual([]);
  });
});
