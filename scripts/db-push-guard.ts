// #78: db:push refuses a checkout that lacks migrations on origin/main. On 2026-11-02 a push from a
// checkout on another branch reported "up to date" while prod was missing three migrations.

/** The migration files on origin/main (paths from `git ls-tree`) that `local` (file names) lacks. */
export function missingMigrations(remotePaths: string[], local: string[]): string[] {
  const have = new Set(local);
  return remotePaths
    .map((path) => path.split('/').pop() ?? '')
    .filter((name) => name.endsWith('.sql') && !have.has(name));
}
