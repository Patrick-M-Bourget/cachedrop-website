// #43: exercise the shared check command at its npm process boundary.
import { afterEach, expect, test } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync, symlinkSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const fixtures: string[] = [];
afterEach(() => { for (const dir of fixtures.splice(0)) rmSync(dir, { recursive: true, force: true }); });

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'cachedrop-check-'));
  fixtures.push(dir);
  mkdirSync(join(dir, 'scripts'));
  copyFileSync(resolve('scripts/check.mjs'), join(dir, 'scripts/check.mjs'));
  writeFileSync(join(dir, '.node-version'), process.versions.node);
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ packageManager: 'npm@11.19.1' }));
  const npm = join(dir, 'npm.mjs');
  writeFileSync(npm, `import {appendFileSync} from 'node:fs';
    const args=process.argv.slice(2);
    if(args[0]==='--version'){console.log(process.env.TEST_NPM_VERSION ?? '11.19.1');process.exit(0);}
    appendFileSync(process.env.TEST_CALLS,JSON.stringify(args)+'\\n');
    if(args[0]==='ci' && process.env.TEST_LOCK_FAILURE) process.exit(42);
  `);
  // #78: a stand-in for the Decisions order check, failing when TEST_DECISIONS_FAILURE is set.
  const decisions = join(dir, 'scripts/check-decisions.sh');
  writeFileSync(decisions, '#!/bin/sh\n[ -z "$TEST_DECISIONS_FAILURE" ]\n');
  chmodSync(decisions, 0o755);
  const calls = join(dir, 'calls.jsonl');
  writeFileSync(calls, '');
  return {
    dir,
    run: (profile = 'site', env: NodeJS.ProcessEnv = {}) => spawnSync(process.execPath,
      [join(dir, 'scripts/check.mjs'), profile], { cwd: dir, encoding: 'utf8',
        env: { ...process.env, npm_execpath: npm, TEST_CALLS: calls, ...env } }),
    calls: () => readFileSync(calls, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)),
  };
}

test('a lockfile failure stops before typechecking, building or testing', () => {
  const f = fixture();
  expect(f.run('site', { TEST_LOCK_FAILURE: '1' }).status).toBe(42);
  expect(f.calls()).toEqual([['ci']]);
});

test('site checks retain typechecking, unit, build, static and non-reference browser coverage', () => {
  const f = fixture();
  expect(f.run().status).toBe(0);
  const calls = f.calls();
  expect(calls[0]).toEqual(['ci']);
  for (const name of ['typecheck', 'test:unit', 'build', 'check:static']) expect(calls).toContainEqual(['run', name]);
  expect(calls.at(-1)).toEqual(['test', '--', '--grep-invert', 'reference render']);
  expect(calls.some(args => args.includes('playwright') && args.includes('install') && args.includes('chromium'))).toBe(true);
});

test('reference checks retain the separate reference-render browser selection', () => {
  const f = fixture();
  expect(f.run('reference').status).toBe(0);
  const calls = f.calls();
  expect(calls).toContainEqual(['run', 'typecheck']);
  expect(calls).toContainEqual(['run', 'build']);
  expect(calls.at(-1)).toEqual(['test', '--', '--grep', 'reference render']);
  expect(calls).not.toContainEqual(['run', 'test:unit']);
});

test('Node and npm mismatches stop before installing or checking the project', () => {
  const f = fixture();
  expect(f.run('site', { TEST_NPM_VERSION: '11.6.2' }).status).toBe(2);
  expect(f.calls()).toEqual([]);
  writeFileSync(join(f.dir, '.node-version'), '0.0.0');
  expect(f.run().status).toBe(2);
  expect(f.calls()).toEqual([]);
});

test('#78: a node_modules symlink stops before npm ci can empty its target', () => {
  const f = fixture();
  mkdirSync(join(f.dir, 'elsewhere'));
  symlinkSync(join(f.dir, 'elsewhere'), join(f.dir, 'node_modules'));
  const result = f.run();
  expect(result.status).toBe(2);
  expect(result.stderr).toMatch(/node_modules is a symlink/);
  expect(f.calls()).toEqual([]);
});

test('#78: Decisions out of order stop before npm ci', () => {
  const f = fixture();
  expect(f.run('site', { TEST_DECISIONS_FAILURE: '1' }).status).not.toBe(0);
  expect(f.calls()).toEqual([]);
});
