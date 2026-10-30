// Staging never writes the releases table or feed. It accepts only final, signed build artifacts.
import { createHash, createPublicKey, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { createInterface } from 'node:readline/promises';

export const MAX_BYTES = 50 * 1024 * 1024;
export const APPROVED_PUBLIC_KEY = 'dbugwfdqmiKKRO2QcO8iivl86IfqhiZeVF1RIvfRTL4=';
export const PROJECTS = { dev: 'https://nyefnnwhnlyovpdmzxiw.supabase.co', prod: 'https://dqpvfcthotskzfvdpjdm.supabase.co' };
export interface ArtifactIdentity {
  version: string; build: string; filename: string; length: number; sha256: string;
  edSignature: string; publicKey: string; url: string; bundleID: string; teamID: string;
  commit: string; releaseNotesSHA256: string;
}
// The command resolves an allowlisted target first; library callers supply an explicit storage adapter.
export interface StorageOptions { supabaseUrl: string; key: string; fetch: typeof fetch }
const hash = (body: Uint8Array) => createHash('sha256').update(body).digest('hex');
function assertBytes(body: Uint8Array, identity: ArtifactIdentity) {
  if (body.byteLength !== identity.length || hash(body) !== identity.sha256) throw new Error('Artifact size/hash mismatch; no replacement is allowed.');
}
export async function loadArtifact(dmgPath: string, identityPath: string, approvedPublicKey = APPROVED_PUBLIC_KEY) {
  const size = (await stat(dmgPath)).size;
  if (size <= 0 || size > MAX_BYTES) throw new Error('DMG must be nonempty and within the 50 MB storage cap.');
  const identity: ArtifactIdentity = JSON.parse(await readFile(identityPath, 'utf8'));
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(identity.version) || !/^[1-9]\d*$/.test(identity.build)
      || basename(dmgPath) !== `CacheDrop-${identity.version}.dmg` || identity.filename !== basename(dmgPath)
      || identity.bundleID !== 'com.patrickbourget.CacheDrop' || identity.teamID !== '8F5K2ZRP5T'
      || !/^[a-f0-9]{40}$/.test(identity.commit) || !/^[a-f0-9]{64}$/.test(identity.releaseNotesSHA256)) {
    throw new Error('Invalid final release identity or stable DMG filename.');
  }
  // Existing website comparisons use PostgreSQL int[] versions and a bigint build.
  if (identity.version.split('.').some(part => BigInt(part) > 2147483647n) || BigInt(identity.build) > 9223372036854775807n) {
    throw new Error('Version or build exceeds the website database limits.');
  }
  const body = new Uint8Array(await readFile(dmgPath));
  assertBytes(body, identity);
  if (identity.publicKey !== approvedPublicKey) throw new Error('Artifact public key does not match the approved app key.');
  const key = createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(approvedPublicKey, 'base64')]), format: 'der', type: 'spki' });
  if (!verify(null, body, key, Buffer.from(identity.edSignature, 'base64'))) throw new Error('Final DMG EdDSA signature is invalid.');
  return { identity, body };
}
function paths(identity: ArtifactIdentity, options: StorageOptions) {
  const publicPath = `updates/${identity.version}/${identity.filename}`;
  const expected = `${options.supabaseUrl}/storage/v1/object/public/${publicPath}`;
  if (identity.url !== expected) throw new Error('Artifact URL does not belong to this explicit target and immutable version path.');
  return [publicPath, `releases/${identity.filename}`];
}
function headers(options: StorageOptions) { return { apikey: options.key, Authorization: `Bearer ${options.key}` }; }
async function bytes(response: Response, identity: ArtifactIdentity) {
  if (!response.ok) throw new Error(`Storage retrieval failed (HTTP ${response.status}).`);
  assertBytes(new Uint8Array(await response.arrayBuffer()), identity);
}
export async function verifyStagedArtifact(identity: ArtifactIdentity, options: StorageOptions) {
  const [publicPath, privatePath] = paths(identity, options);
  await bytes(await options.fetch(`${options.supabaseUrl}/storage/v1/object/public/${publicPath}`), identity);
  // Same authorized signed-URL interface used by the website gate; no latest row is required for staging.
  const signed = await options.fetch(`${options.supabaseUrl}/storage/v1/object/sign/${privatePath}`, {
    method: 'POST', headers: { ...headers(options), 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 60 }),
  });
  if (!signed.ok) throw new Error(`Private signed download failed (HTTP ${signed.status}).`);
  const result = await signed.json();
  if (typeof result.signedURL !== 'string') throw new Error('Private signed download returned no URL.');
  const signedUrl = new URL(result.signedURL.startsWith('/object/') ? `/storage/v1${result.signedURL}` : result.signedURL, options.supabaseUrl);
  if (signedUrl.origin !== new URL(options.supabaseUrl).origin || signedUrl.pathname !== `/storage/v1/object/sign/${privatePath}`) {
    throw new Error('Private signed download returned an unexpected URL.');
  }
  await bytes(await options.fetch(signedUrl), identity);
  const anonymous = await options.fetch(`${options.supabaseUrl}/storage/v1/object/public/${privatePath}`);
  if (anonymous.ok) throw new Error('The releases bucket must remain private.');
  if (![400, 401, 403, 404].includes(anonymous.status)) throw new Error('Could not verify the private bucket access restriction.');
}
export async function stageArtifact(dmgPath: string, identityPath: string, options: StorageOptions, approvedPublicKey = APPROVED_PUBLIC_KEY) {
  const { identity, body } = await loadArtifact(dmgPath, identityPath, approvedPublicKey);
  const destinations = paths(identity, options);
  const missing: string[] = [];
  // Check BOTH existing destinations before writing either. A mismatch is an immutable conflict.
  for (const path of destinations) {
    const existing = await options.fetch(`${options.supabaseUrl}/storage/v1/object/authenticated/${path}`, { headers: headers(options) });
    if (existing.status === 404 || existing.status === 400) {
      // Supabase Storage uses 400 with JSON statusCode=404 for missing objects.
      if (existing.status === 400) {
        const error = await existing.json();
        if (String(error.statusCode) !== '404') throw new Error('Storage lookup failed; nothing was replaced.');
      }
      missing.push(path);
    } else await bytes(existing, identity);
  }
  for (const path of missing) {
    const upload = await options.fetch(`${options.supabaseUrl}/storage/v1/object/${path}`, {
      method: 'POST', headers: { ...headers(options), 'Content-Type': 'application/x-apple-diskimage', 'x-upsert': 'false' }, body,
    });
    if (!upload.ok) {
      // Includes races or a successful write whose response was lost: reuse only exact stored bytes.
      await bytes(await options.fetch(`${options.supabaseUrl}/storage/v1/object/authenticated/${path}`, { headers: headers(options) }), identity);
    }
  }
  await verifyStagedArtifact(identity, options);
  return identity;
}
export function targetCredentials(target: string, shellEnv: Record<string, string | undefined>, local: Record<string, string | undefined>) {
  if (target !== 'dev' && target !== 'prod') throw new Error('Target must be explicit dev or prod.');
  const source = target === 'dev' ? local : shellEnv;
  if (source.SUPABASE_URL !== PROJECTS[target] || !source.SUPABASE_SECRET_KEY) throw new Error(`Use the configured ${target} Supabase project credentials; target mismatch or missing credentials.`);
  return { supabaseUrl: PROJECTS[target], key: source.SUPABASE_SECRET_KEY };
}
export function localEnvironment() {
  try { return parseEnv(readFileSync(resolve(import.meta.dirname, '../.env.local'), 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}; throw error; }
}
export async function confirmProduction(action: string) {
  const reader = createInterface({ input: process.stdin, output: process.stdout });
  try { return (await reader.question(`${action} PROD? Type prod to continue: `)).trim() === 'prod'; }
  finally { reader.close(); }
}
if (import.meta.main) {
  try {
    const [target, dmgPath, identityPath, ...extra] = process.argv.slice(2);
    if (!target || !dmgPath || !identityPath || extra.length) throw new Error('usage: scripts/stage-release.sh <dev|prod> DMG release-identity.json');
    const credentials = targetCredentials(target, process.env, localEnvironment());
    if (target === 'prod' && !await confirmProduction('Stage')) throw new Error('Not confirmed; nothing staged.');
    const identity = await stageArtifact(dmgPath, identityPath, { ...credentials, fetch });
    console.log(`Staged and verified ${identity.filename} in ${target} public updates and private releases; latest and appcast unchanged.`);
  } catch (error) { console.error(error instanceof Error ? error.message : 'Staging failed.'); process.exitCode = 1; }
}
