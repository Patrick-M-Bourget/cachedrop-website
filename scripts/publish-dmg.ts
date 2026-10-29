// Publishes a CacheDrop DMG (Decision 15): uploads it to the private `releases` bucket and records
// it as the latest release. Run it through scripts/publish-dmg.sh; see the usage line below.
//
// dev reads SUPABASE_URL and SUPABASE_SECRET_KEY from .env.local. prod reads them from the shell
// environment only (Production values live in Vercel, not .env.local), and asks for confirmation.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { parseEnv } from 'node:util';

export const BUCKET = 'releases';
export const MAX_BYTES = 50 * 1024 * 1024; // Supabase Free's per-file cap (Decision 13)
const USAGE = 'usage: scripts/publish-dmg.sh <dev|prod> <path/to/CacheDrop-x.y.z.dmg>';
const FILENAME = /^CacheDrop-(\d+)\.(\d+)\.(\d+)\.dmg$/;

type Result<T> = Promise<{ data: T | null; error: { message: string } | null }>;

/** The slice of the supabase-js client this script uses. */
export interface ReleaseClient {
  from(table: 'releases'): { select(columns: string): Result<Array<{ version: string; is_latest: boolean }>> };
  storage: {
    from(bucket: string): {
      upload(path: string, body: Uint8Array, opts: { contentType: string; upsert: boolean }): Result<unknown>;
      remove(paths: string[]): Result<unknown>;
    };
  };
  rpc(
    fn: 'publish_release',
    args: { p_version: string; p_filename: string; p_size_bytes: number; p_sha256: string },
  ): Result<unknown>;
}

export interface Io {
  shellEnv: Record<string, string | undefined>;
  loadEnvLocal(): Record<string, string | undefined>;
  readFile(path: string): Promise<Uint8Array>;
  createClient(url: string, key: string): ReleaseClient;
  confirm(question: string): Promise<boolean>;
  out(message: string): void;
  err(message: string): void;
}

class Refusal extends Error {
  readonly code: 1 | 2;
  constructor(message: string, code: 1 | 2) {
    super(message);
    this.code = code;
  }
}

const usageError = (message: string) => new Refusal(`${message}\n${USAGE}`, 2);

function compareVersions(a: string, b: string): number {
  const [x, y] = [a, b].map((v) => v.split('.').map(Number));
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

function supabaseCredentials(source: Record<string, string | undefined>, where: string) {
  const missing = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY'].filter((k) => !source[k]);
  if (missing.length) throw new Refusal(`${missing.join(' and ')} not set in ${where}.`, 2);
  return { url: source.SUPABASE_URL!, key: source.SUPABASE_SECRET_KEY! };
}

function loadDevEnv(io: Io) {
  try {
    return io.loadEnvLocal();
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw e;
  }
}

async function readDmg(io: Io, path: string) {
  try {
    return await io.readFile(path);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') throw usageError(`${path}: file not found.`);
    throw e;
  }
}

async function publish(argv: string[], io: Io): Promise<void> {
  if (argv.length !== 2) throw new Refusal(USAGE, 2);
  const [target, path] = argv;
  if (target !== 'dev' && target !== 'prod') throw usageError(`Target must be dev or prod, not "${target}".`);

  const filename = basename(path);
  const match = FILENAME.exec(filename);
  if (!match) throw usageError(`${filename}: the file must be named CacheDrop-x.y.z.dmg.`);
  const version = match.slice(1, 4).map(Number).join('.');

  const body = await readDmg(io, path);
  if (body.byteLength === 0) throw usageError(`${path} is empty.`);
  if (body.byteLength > MAX_BYTES) throw usageError(`${path} is over the 50 MB per-file cap.`);

  const devEnv = loadDevEnv(io);
  let creds;
  if (target === 'dev') {
    creds = supabaseCredentials(devEnv, '.env.local');
  } else {
    creds = supabaseCredentials(io.shellEnv, 'the shell environment (use the Production values from Vercel)');
    if (creds.url === devEnv.SUPABASE_URL) {
      throw new Refusal('SUPABASE_URL in the shell is the dev project from .env.local, not prod.', 2);
    }
    const host = new URL(creds.url).host;
    if (!(await io.confirm(`Publish ${filename} to PROD (${host})? Type "prod" to continue: `))) {
      throw new Refusal('Not confirmed; nothing was published.', 1);
    }
  }

  const supabase = io.createClient(creds.url, creds.key);

  const existing = await supabase.from('releases').select('version, is_latest');
  if (existing.error) throw new Refusal(`Could not read releases: ${existing.error.message}`, 1);
  const rows = existing.data ?? [];
  if (rows.some((r) => r.version === version)) throw new Refusal(`${version} is already published; nothing was changed.`, 1);
  const latest = rows.find((r) => r.is_latest);
  if (latest && compareVersions(version, latest.version) < 0) {
    throw new Refusal(`${version} is older than the latest release ${latest.version}; nothing was changed.`, 1);
  }

  const bucket = supabase.storage.from(BUCKET);
  const upload = await bucket.upload(filename, body, { contentType: 'application/x-apple-diskimage', upsert: false });
  if (upload.error) throw new Refusal(`Upload failed: ${upload.error.message}`, 1);

  const recorded = await supabase.rpc('publish_release', {
    p_version: version,
    p_filename: filename,
    p_size_bytes: body.byteLength,
    p_sha256: createHash('sha256').update(body).digest('hex'),
  });
  if (recorded.error) {
    const removed = await bucket.remove([filename]);
    const cleanup = removed.error
      ? ` Removing the uploaded ${filename} also failed (${removed.error.message}); delete it from the bucket by hand.`
      : ` The uploaded ${filename} was removed.`;
    throw new Refusal(`Recording the release failed: ${recorded.error.message}.${cleanup}`, 1);
  }

  io.out(`Published ${filename} to ${target}; ${version} is now the latest release.`);
}

/** Runs the script and returns its exit code: 0 published, 1 refused or failed, 2 bad input. */
export async function run(argv: string[], io: Io): Promise<number> {
  try {
    await publish(argv, io);
    return 0;
  } catch (e) {
    if (e instanceof Refusal) {
      io.err(e.message);
      return e.code;
    }
    throw e;
  }
}

if (import.meta.main) {
  const { createClient } = await import('@supabase/supabase-js');
  const root = resolve(import.meta.dirname, '..');
  const io: Io = {
    shellEnv: process.env,
    loadEnvLocal: () => parseEnv(readFileSync(resolve(root, '.env.local'), 'utf8')),
    readFile: async (p) => new Uint8Array(await readFile(p)),
    createClient: (url, key) =>
      createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) as unknown as ReleaseClient,
    confirm: async (question) => {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      try {
        return (await rl.question(question)).trim() === 'prod';
      } finally {
        rl.close();
      }
    },
    out: (m) => console.log(m),
    err: (m) => console.error(m),
  };
  process.exitCode = await run(process.argv.slice(2), io);
}
