// Applies supabase/migrations to dev or prod with the Supabase CLI (Decision 13).
//   npm run db:push -- dev [--dry-run]
// The connection string comes from .env.local (SUPABASE_DEV_DB_URL or SUPABASE_PROD_DB_URL) and goes
// to the CLI without being printed. prod is migrated at launch.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

const [target, ...rest] = process.argv.slice(2);
if (target !== 'dev' && target !== 'prod') {
  console.error('usage: npm run db:push -- <dev|prod> [--dry-run]');
  process.exit(2);
}
const root = resolve(import.meta.dirname, '..');
const name = target === 'dev' ? 'SUPABASE_DEV_DB_URL' : 'SUPABASE_PROD_DB_URL';
let url: string | undefined;
try {
  url = parseEnv(readFileSync(resolve(root, '.env.local'), 'utf8'))[name];
} catch {
  // A missing .env.local reads as unset.
}
if (!url) {
  console.error(`${name} is not set in .env.local.`);
  process.exit(2);
}
const cli = spawnSync('npx', ['supabase', 'db', 'push', '--db-url', url, ...rest], { cwd: root, stdio: 'inherit' });
process.exit(cli.status ?? 1);
