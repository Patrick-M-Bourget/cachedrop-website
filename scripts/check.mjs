// #43: the same required checks and toolchain locally and in both existing CI jobs.
import { lstatSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const profile = process.argv[2] ?? 'site';
const expectedNode = readFileSync(new URL('../.node-version', import.meta.url), 'utf8').trim();
const { packageManager } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const expectedNpm = /^npm@(\d+\.\d+\.\d+)$/.exec(packageManager)?.[1];
const npmPath = process.env.npm_execpath;
function reject(message) { console.error(message); process.exit(2); }
if (process.argv.length > 3 || !['site', 'reference'].includes(profile)) reject('Usage: scripts/check.sh [site|reference]');
if (process.versions.node !== expectedNode) reject(`Use Node ${expectedNode} from .node-version.`);
if (!expectedNpm || !npmPath) reject('Run scripts/check.sh to use the pinned npm.');
const version = spawnSync(process.execPath, [npmPath, '--version'], { encoding: 'utf8' });
if (version.status !== 0 || version.stdout.trim() !== expectedNpm) reject(`Use npm ${expectedNpm}; run scripts/check.sh.`);

function run(script) {
  console.log(`[check] ${script}`);
  const result = spawnSync(script, { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function npm(...args) {
  console.log(`[check] npm ${args.join(' ')}`);
  const result = spawnSync(process.execPath, [npmPath, ...args], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// #78: npm ci empties node_modules first; through a symlink that empties another checkout's folder.
if (lstatSync(new URL('../node_modules', import.meta.url), { throwIfNoEntry: false })?.isSymbolicLink()) {
  reject('node_modules is a symlink: npm ci would empty the folder it points to. Remove the link and run npm ci in this worktree.');
}
run('scripts/check-decisions.sh'); // #78: Decisions merge by union (.gitattributes); their order is checked here.
npm('ci'); // Fail a stale lockfile before any typecheck, build or tests.
npm('run', 'typecheck');
if (profile === 'site') npm('run', 'test:unit');
npm('run', 'build');
if (profile === 'site') npm('run', 'check:static');
const dependencies = process.platform === 'linux' && process.env.CI ? ['--with-deps'] : [];
npm('exec', '--', 'playwright', 'install', ...dependencies, 'chromium');
npm('test', '--', profile === 'site' ? '--grep-invert' : '--grep', 'reference render');
