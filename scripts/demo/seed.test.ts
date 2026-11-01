// #48: the demo seed writes real bytes where CacheDrop's rules look, dates downloads, and resets to the same state.
// Runs only on macOS (the script uses BSD stat, xattr and APFS dates), always in a temp folder with tiny sizes.
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const script = fileURLToPath(new URL('./seed.sh', import.meta.url));
const env = { ...process.env, SIZE_SCALE: '0.0001', FREE_HEADROOM_GB: '0' };
const temporary: string[] = [];
afterEach(async () => { for (const path of temporary.splice(0)) await rm(path, { recursive: true, force: true }); });

async function home() {
  const directory = await mkdtemp(join(tmpdir(), 'cachedrop-demo-')); temporary.push(directory);
  return directory;
}
function run(...args: string[]) { return spawnSync('bash', [script, ...args], { encoding: 'utf8', env }); }
function files(root: string, skip: string[] = ['.cachedrop-demo-seed', '.Trash']): string[] {
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(root, join(entry.parentPath, entry.name)))
    .filter((path) => !skip.some((part) => path.startsWith(part + '/')))
    .map((path) => `${statSync(join(root, path)).size} ${path}`)
    .sort();
}
const daysAgo = (date: Date) => (Date.now() - date.getTime()) / 86_400_000;

// Each case runs the script (hundreds of small writes) one to three times.
describe.skipIf(process.platform !== 'darwin')('scripts/demo/seed.sh', { timeout: 60_000 }, () => {
  it('prints the plan and total in a dry run and writes nothing', async () => {
    const target = await home();
    const result = spawnSync('bash', [script, '--dry-run', '--target', target, '--i-know'], { encoding: 'utf8', env: { ...process.env, FREE_HEADROOM_GB: '0' } });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Total written:            12.00 GB');
    expect(result.stdout).toContain('Library/Caches/Ableton/Cache/Decoding');
    expect(result.stdout).toContain('Library/Developer/Xcode/DerivedData/BeatGrid-');
    expect(readdirSync(target)).toEqual([]);
  });

  it('writes fully allocated files at the catalog paths, with old downloads and a tied deleted app', async () => {
    const target = await home();
    const result = run('--target', target, '--i-know');
    expect(result.status, result.stderr).toBe(0);
    for (const path of ['Library/Caches/Ableton/Cache/Decoding', 'Library/Caches/com.ableton.live', '.npm/_cacache',
      'Library/Caches/Homebrew/downloads', 'Library/Application Support/com.driftwave.LoopSmith',
      'Library/Saved Application State/com.driftwave.LoopSmith.savedState', 'Library/Preferences/com.driftwave.LoopSmith.plist']) {
      expect(existsSync(join(target, path)), path).toBe(true);
    }
    // Xcode's DerivedData names end in 28 lowercase letters (mac-cleaner #545).
    for (const name of readdirSync(join(target, 'Library/Developer/Xcode/DerivedData'))) expect(name).toMatch(/^.+-[a-z]{28}$/);
    for (const line of files(target)) {
      const path = join(target, line.slice(line.indexOf(' ') + 1));
      const info = statSync(path);
      expect(info.blocks * 512, path).toBeGreaterThanOrEqual(info.size);
    }
    for (const dmg of readdirSync(join(target, 'Downloads'))) {
      const info = statSync(join(target, 'Downloads', dmg));
      expect(daysAgo(info.mtime), dmg).toBeGreaterThan(7);
      expect(daysAgo(info.birthtime), dmg).toBeGreaterThan(7);
    }
    expect(run('--target', target, '--i-know').stderr).toContain('already seeded');
  });

  it('reset removes only what it wrote, its marked Trash items, and seeds the same files again', async () => {
    const target = await home();
    expect(run('--target', target, '--i-know').status).toBe(0);
    const before = files(target);
    // What a cleanup does: deletes caches, moves user files to the Trash.
    await rm(join(target, 'Library/Caches/Ableton/Cache'), { recursive: true });
    await mkdir(join(target, '.Trash'));
    await rename(join(target, 'Downloads/TapeEcho-3.0-Installer.dmg'), join(target, '.Trash/TapeEcho-3.0-Installer.dmg'));
    await writeFile(join(target, '.Trash/yours.txt'), 'not seeded');
    await writeFile(join(target, 'Downloads/yours.pdf'), 'not seeded');
    const result = run('reset', '--target', target, '--i-know');
    expect(result.status, result.stderr).toBe(0);
    expect(readdirSync(join(target, '.Trash'))).toEqual(['yours.txt']);
    expect(files(target).filter((line) => !line.endsWith('yours.pdf'))).toEqual(before);
    expect(existsSync(join(target, 'Downloads/yours.pdf'))).toBe(true);
    expect(run('remove', '--target', target, '--i-know').status).toBe(0);
    expect(readdirSync(target).sort()).toEqual(['.Trash', 'Downloads']);
  });

  it('refuses a home that is not the demo user’s, a test folder without --i-know, and too little space', async () => {
    const target = await home();
    // Never run the unguarded forms as demo: they would seed that real home.
    if (process.env.USER !== 'demo') {
      expect(run().stderr).toContain('run this as the macOS user "demo"');
      expect(run('--target', process.env.HOME ?? '/', '--i-know').stderr).toContain('not "demo"');
    }
    expect(run('--target', target).stderr).toContain('needs --i-know');
    const full = spawnSync('bash', [script, '--target', target, '--i-know'], { encoding: 'utf8', env: { ...env, FREE_HEADROOM_GB: '1000000' } });
    expect(full.stderr).toContain('refusing:');
    expect(readdirSync(target)).toEqual([]);
  });
});
