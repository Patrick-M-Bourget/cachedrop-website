import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { run, type Io } from './publish-dmg.ts';

const DEV_ENV = { SUPABASE_URL: 'https://dev-ref.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_dev' };
const PROD_ENV = { SUPABASE_URL: 'https://prod-ref.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_prod' };

type Row = { version: string; filename: string; size_bytes: number; sha256: string; is_latest: boolean };

// An in-memory stand-in for the slice of supabase-js the script uses, behaving like the
// migration: versions are unique, publish_release refuses a version that isn't newer, and the
// bucket refuses to overwrite an object.
function fakeSupabase(seed: Array<Pick<Row, 'version' | 'is_latest'>> = []) {
  const rows: Row[] = seed.map((r) => ({
    ...r,
    filename: `CacheDrop-${r.version}.dmg`,
    size_bytes: 1,
    sha256: '0'.repeat(64),
  }));
  const objects = new Map<string, { body: Uint8Array; contentType?: string }>();
  const state = { rows, objects, failRpc: false, failUpload: false, url: '', key: '' };
  const newer = (a: string, b: string) => {
    const [x, y] = [a, b].map((v) => v.split('.').map(Number));
    for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
    return false;
  };
  const client = {
    from(table: string) {
      if (table !== 'releases') throw new Error(`unexpected table ${table}`);
      return {
        select: async () => ({ data: rows.map((r) => ({ version: r.version, is_latest: r.is_latest })), error: null }),
      };
    },
    storage: {
      from(bucket: string) {
        if (bucket !== 'releases') throw new Error(`unexpected bucket ${bucket}`);
        return {
          async upload(path: string, body: Uint8Array, opts: { contentType?: string; upsert?: boolean }) {
            if (state.failUpload) return { data: null, error: { message: 'storage down' } };
            if (objects.has(path) && !opts.upsert) return { data: null, error: { message: 'The resource already exists' } };
            objects.set(path, { body, contentType: opts.contentType });
            return { data: { path }, error: null };
          },
          async remove(paths: string[]) {
            for (const p of paths) objects.delete(p);
            return { data: [], error: null };
          },
        };
      },
    },
    async rpc(fn: string, args: { p_version: string; p_filename: string; p_size_bytes: number; p_sha256: string }) {
      if (fn !== 'publish_release') throw new Error(`unexpected rpc ${fn}`);
      if (state.failRpc) return { data: null, error: { message: 'connection reset' } };
      const latest = rows.find((r) => r.is_latest);
      if (rows.some((r) => r.version === args.p_version)) return { data: null, error: { message: 'duplicate key' } };
      if (latest && !newer(args.p_version, latest.version)) return { data: null, error: { message: 'not newer' } };
      for (const r of rows) r.is_latest = false;
      const row: Row = {
        version: args.p_version,
        filename: args.p_filename,
        size_bytes: args.p_size_bytes,
        sha256: args.p_sha256,
        is_latest: true,
      };
      rows.push(row);
      return { data: row, error: null };
    },
  };
  return { client, state };
}

function harness(opts: {
  files?: Record<string, Uint8Array>;
  envLocal?: Record<string, string> | null;
  shellEnv?: Record<string, string>;
  confirm?: boolean;
  seed?: Array<Pick<Row, 'version' | 'is_latest'>>;
} = {}) {
  const supabase = fakeSupabase(opts.seed);
  const out: string[] = [];
  const err: string[] = [];
  const prompts: string[] = [];
  const io: Io = {
    shellEnv: opts.shellEnv ?? {},
    loadEnvLocal: () => {
      if (opts.envLocal === null) throw Object.assign(new Error('missing'), { code: 'ENOENT' });
      return opts.envLocal ?? DEV_ENV;
    },
    readFile: async (path) => {
      const f = opts.files?.[path];
      if (!f) throw Object.assign(new Error(`ENOENT: ${path}`), { code: 'ENOENT' });
      return f;
    },
    createClient: (url, key) => {
      supabase.state.url = url;
      supabase.state.key = key;
      return supabase.client;
    },
    confirm: async (question) => {
      prompts.push(question);
      return opts.confirm ?? false;
    },
    out: (m) => out.push(m),
    err: (m) => err.push(m),
  };
  return { io, supabase: supabase.state, out, err, prompts };
}

const dmg = (n = 16) => new Uint8Array(n).fill(7);
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

describe('publish-dmg argument checks', () => {
  it('prints usage and exits 2 without arguments', async () => {
    const h = harness();
    expect(await run([], h.io)).toBe(2);
    expect(h.err.join('\n')).toMatch(/usage: scripts\/publish-dmg\.sh <dev\|prod> <path\/to\/CacheDrop-x\.y\.z\.dmg>/i);
  });

  it('refuses a target other than dev or prod', async () => {
    const h = harness({ files: { 'CacheDrop-0.9.3.dmg': dmg() } });
    expect(await run(['staging', 'CacheDrop-0.9.3.dmg'], h.io)).toBe(2);
    expect(h.err.join('\n')).toMatch(/dev or prod/);
  });

  it.each(['cachedrop-0.9.3.dmg', 'CacheDrop-0.9.dmg', 'CacheDrop-0.9.3-beta.dmg', 'CacheDrop-0.9.3.zip', 'CacheDrop-v0.9.3.dmg'])(
    'refuses a file not named CacheDrop-x.y.z.dmg: %s',
    async (name) => {
      const h = harness({ files: { [name]: dmg() } });
      expect(await run(['dev', name], h.io)).toBe(2);
      expect(h.err.join('\n')).toMatch(/CacheDrop-x\.y\.z\.dmg/);
      expect(h.supabase.objects.size).toBe(0);
    },
  );

  it('refuses a file that does not exist', async () => {
    const h = harness();
    expect(await run(['dev', 'dist/CacheDrop-0.9.3.dmg'], h.io)).toBe(2);
    expect(h.err.join('\n')).toMatch(/not found/i);
  });

  it('refuses an empty file and one over the 50 MB cap', async () => {
    const empty = harness({ files: { 'CacheDrop-0.9.3.dmg': new Uint8Array(0) } });
    expect(await run(['dev', 'CacheDrop-0.9.3.dmg'], empty.io)).toBe(2);
    expect(empty.err.join('\n')).toMatch(/empty/i);

    const big = harness({ files: { 'CacheDrop-0.9.3.dmg': new Uint8Array(50 * 1024 * 1024 + 1) } });
    expect(await run(['dev', 'CacheDrop-0.9.3.dmg'], big.io)).toBe(2);
    expect(big.err.join('\n')).toMatch(/50 MB/);
  });

  it('refuses dev when .env.local is missing a Supabase variable, without printing values', async () => {
    const h = harness({ files: { 'CacheDrop-0.9.3.dmg': dmg() }, envLocal: { SUPABASE_URL: DEV_ENV.SUPABASE_URL } });
    expect(await run(['dev', 'CacheDrop-0.9.3.dmg'], h.io)).toBe(2);
    expect(h.err.join('\n')).toMatch(/SUPABASE_SECRET_KEY/);
    expect([...h.out, ...h.err].join('\n')).not.toContain(DEV_ENV.SUPABASE_URL);
  });
});

describe('publish-dmg against dev', () => {
  it('uploads the DMG to the private bucket and records it as latest', async () => {
    const body = dmg(64);
    const h = harness({ files: { 'build/CacheDrop-0.9.3.dmg': body } });

    expect(await run(['dev', 'build/CacheDrop-0.9.3.dmg'], h.io)).toBe(0);

    expect(h.supabase.url).toBe(DEV_ENV.SUPABASE_URL);
    expect(h.supabase.key).toBe(DEV_ENV.SUPABASE_SECRET_KEY);
    expect(h.supabase.objects.get('CacheDrop-0.9.3.dmg')).toEqual({ body, contentType: 'application/x-apple-diskimage' });
    expect(h.supabase.rows).toEqual([
      { version: '0.9.3', filename: 'CacheDrop-0.9.3.dmg', size_bytes: 64, sha256: sha(body), is_latest: true },
    ]);
    expect(h.out.join('\n')).toMatch(/0\.9\.3.*latest/);
    expect([...h.out, ...h.err].join('\n')).not.toContain(DEV_ENV.SUPABASE_SECRET_KEY);
  });

  it('uses .env.local for dev even when the shell has other Supabase values', async () => {
    const h = harness({ files: { 'CacheDrop-0.9.3.dmg': dmg() }, shellEnv: PROD_ENV });
    expect(await run(['dev', 'CacheDrop-0.9.3.dmg'], h.io)).toBe(0);
    expect(h.supabase.url).toBe(DEV_ENV.SUPABASE_URL);
  });

  it('moves latest to a newer version', async () => {
    const h = harness({ files: { 'CacheDrop-0.10.0.dmg': dmg() }, seed: [{ version: '0.9.3', is_latest: true }] });
    expect(await run(['dev', 'CacheDrop-0.10.0.dmg'], h.io)).toBe(0);
    expect(h.supabase.rows.map((r) => [r.version, r.is_latest])).toEqual([
      ['0.9.3', false],
      ['0.10.0', true],
    ]);
  });

  it('refuses to publish a version that already exists, uploading nothing', async () => {
    const h = harness({ files: { 'CacheDrop-0.9.3.dmg': dmg() }, seed: [{ version: '0.9.3', is_latest: true }] });
    expect(await run(['dev', 'CacheDrop-0.9.3.dmg'], h.io)).toBe(1);
    expect(h.err.join('\n')).toMatch(/0\.9\.3 is already published/);
    expect(h.supabase.objects.size).toBe(0);
    expect(h.supabase.rows).toHaveLength(1);
  });

  it('refuses a version older than the latest, uploading nothing', async () => {
    const h = harness({ files: { 'CacheDrop-0.9.2.dmg': dmg() }, seed: [{ version: '0.9.10', is_latest: true }] });
    expect(await run(['dev', 'CacheDrop-0.9.2.dmg'], h.io)).toBe(1);
    expect(h.err.join('\n')).toMatch(/older than the latest release 0\.9\.10/);
    expect(h.supabase.objects.size).toBe(0);
    expect(h.supabase.rows.map((r) => r.version)).toEqual(['0.9.10']);
  });

  it('records nothing when the upload fails', async () => {
    const h = harness({ files: { 'CacheDrop-0.9.3.dmg': dmg() } });
    h.supabase.failUpload = true;
    expect(await run(['dev', 'CacheDrop-0.9.3.dmg'], h.io)).toBe(1);
    expect(h.err.join('\n')).toMatch(/upload failed: storage down/i);
    expect(h.supabase.rows).toHaveLength(0);
  });

  it('never overwrites an object already in the bucket', async () => {
    const h = harness({ files: { 'CacheDrop-0.9.3.dmg': dmg() } });
    const stray = { body: dmg(3), contentType: 'application/x-apple-diskimage' };
    h.supabase.objects.set('CacheDrop-0.9.3.dmg', stray);
    expect(await run(['dev', 'CacheDrop-0.9.3.dmg'], h.io)).toBe(1);
    expect(h.err.join('\n')).toMatch(/already exists/);
    expect(h.supabase.objects.get('CacheDrop-0.9.3.dmg')).toBe(stray);
    expect(h.supabase.rows).toHaveLength(0);
  });

  it('removes the uploaded object when recording the release fails', async () => {
    const h = harness({ files: { 'CacheDrop-0.9.3.dmg': dmg() }, seed: [{ version: '0.9.2', is_latest: true }] });
    h.supabase.failRpc = true;
    expect(await run(['dev', 'CacheDrop-0.9.3.dmg'], h.io)).toBe(1);
    expect(h.err.join('\n')).toMatch(/connection reset/);
    expect(h.supabase.objects.size).toBe(0);
    expect(h.supabase.rows.map((r) => [r.version, r.is_latest])).toEqual([['0.9.2', true]]);
  });
});

describe('publish-dmg against prod', () => {
  it('takes the Supabase values from the shell and publishes after confirmation', async () => {
    const h = harness({ files: { 'CacheDrop-0.9.3.dmg': dmg() }, shellEnv: PROD_ENV, confirm: true });
    expect(await run(['prod', 'CacheDrop-0.9.3.dmg'], h.io)).toBe(0);
    expect(h.prompts.join('\n')).toMatch(/prod-ref\.supabase\.co/);
    expect(h.supabase.url).toBe(PROD_ENV.SUPABASE_URL);
    expect(h.supabase.key).toBe(PROD_ENV.SUPABASE_SECRET_KEY);
    expect(h.supabase.rows.map((r) => r.version)).toEqual(['0.9.3']);
  });

  it('publishes nothing when the confirmation is declined', async () => {
    const h = harness({ files: { 'CacheDrop-0.9.3.dmg': dmg() }, shellEnv: PROD_ENV, confirm: false });
    expect(await run(['prod', 'CacheDrop-0.9.3.dmg'], h.io)).toBe(1);
    expect(h.supabase.objects.size).toBe(0);
    expect(h.supabase.rows).toHaveLength(0);
  });

  it('refuses prod without Supabase values in the shell', async () => {
    const h = harness({ files: { 'CacheDrop-0.9.3.dmg': dmg() }, confirm: true });
    expect(await run(['prod', 'CacheDrop-0.9.3.dmg'], h.io)).toBe(2);
    expect(h.err.join('\n')).toMatch(/SUPABASE_URL/);
    expect(h.prompts).toHaveLength(0);
  });

  it('refuses prod when the shell points at the dev project', async () => {
    const h = harness({ files: { 'CacheDrop-0.9.3.dmg': dmg() }, shellEnv: DEV_ENV, confirm: true });
    expect(await run(['prod', 'CacheDrop-0.9.3.dmg'], h.io)).toBe(2);
    expect(h.err.join('\n')).toMatch(/dev project/);
    expect(h.supabase.objects.size).toBe(0);
  });
});
