import { generateKeyPairSync, sign, createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { stageArtifact } from './stage-release.ts';

const temporary: string[] = [];
afterEach(async () => { for (const path of temporary.splice(0)) await rm(path, { recursive: true, force: true }); });
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'cachedrop-stage-')); temporary.push(directory);
  const body = Buffer.from('final signed fixture dmg bytes');
  const keys = generateKeyPairSync('ed25519');
  const filename = 'CacheDrop-0.10.0.dmg', supabaseUrl = 'https://dev.example';
  const identity = { version: '0.10.0', build: '5', bundleID: 'com.patrickbourget.CacheDrop', teamID: '8F5K2ZRP5T',
    filename, length: body.length, sha256: createHash('sha256').update(body).digest('hex'),
    edSignature: sign(null, body, keys.privateKey).toString('base64'),
    publicKey: keys.publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('base64'),
    url: `${supabaseUrl}/storage/v1/object/public/updates/0.10.0/${filename}`, commit: 'a'.repeat(40), releaseNotesSHA256: 'b'.repeat(64) };
  await writeFile(join(directory, filename), body); await writeFile(join(directory, 'identity.json'), JSON.stringify(identity));
  const objects = new Map<string, Uint8Array>(), uploads: string[] = [];
  let failPrivate = false;
  const fetcher: typeof fetch = async (input, init) => {
    const path = new URL(String(input)).pathname.replace('/storage/v1', '');
    if (path.startsWith('/object/sign/') && init?.method === 'POST') return Response.json({ signedURL: path + '?token=fixture' });
    let key = path.replace(/^\/object\/(public\/|authenticated\/|sign\/)?/, '');
    if (path.startsWith('/object/public/releases/')) return new Response('', { status: 400 });
    if (init?.method === 'POST') {
      uploads.push(key);
      if (key.startsWith('releases/') && failPrivate) return new Response('', { status: 500 });
      if (objects.has(key)) return new Response('', { status: 409 });
      objects.set(key, new Uint8Array(init.body as Uint8Array)); return Response.json({ Key: key });
    }
    const stored = objects.get(key);
    return stored ? new Response(stored as BodyInit) : new Response('', { status: 404 });
  };
  return { directory, filename, body, identity, objects, uploads, options: { supabaseUrl, key: 'secret-fixture', fetch: fetcher },
    setFailure(value: boolean) { failPrivate = value; } };
}
it('stages identical bytes in both destinations, verifies retrieval and reuses matching objects', async () => {
  const f = await fixture();
  const staged = await stageArtifact(join(f.directory, f.filename), join(f.directory, 'identity.json'), f.options, f.identity.publicKey);
  expect(staged).toEqual(f.identity);
  expect(f.objects.get(`updates/0.10.0/${f.filename}`)).toEqual(new Uint8Array(f.body));
  expect(f.objects.get(`releases/${f.filename}`)).toEqual(new Uint8Array(f.body));
  await stageArtifact(join(f.directory, f.filename), join(f.directory, 'identity.json'), f.options, f.identity.publicKey);
  expect(f.uploads).toHaveLength(2);
});
it('resumes an identical retry after the private destination fails', async () => {
  const f = await fixture(); f.setFailure(true);
  const stage = () => stageArtifact(join(f.directory, f.filename), join(f.directory, 'identity.json'), f.options, f.identity.publicKey);
  await expect(stage()).rejects.toThrow(/retrieval/i);
  expect(f.objects.size).toBe(1);
  f.setFailure(false);
  await stage();
  expect(f.uploads.filter(path => path.startsWith('updates/'))).toHaveLength(1);
  expect(f.objects.size).toBe(2);
});
it('refuses conflicting existing private bytes before uploading to either destination', async () => {
  const f = await fixture(); const original = new Uint8Array([1, 2]);
  f.objects.set(`releases/${f.filename}`, original);
  await expect(stageArtifact(join(f.directory, f.filename), join(f.directory, 'identity.json'), f.options, f.identity.publicKey)).rejects.toThrow(/mismatch/i);
  expect(f.uploads).toHaveLength(0);
  expect(f.objects.get(`releases/${f.filename}`)).toBe(original);
});
it('rejects an identity with a different target before storage writes', async () => {
  const f = await fixture();
  await expect(stageArtifact(join(f.directory, f.filename), join(f.directory, 'identity.json'), { ...f.options, supabaseUrl: 'https://production.example' }, f.identity.publicKey)).rejects.toThrow(/target/);
  expect(f.uploads).toHaveLength(0);
});
it('requires an approved public key and a valid signature before staging', async () => {
  const f = await fixture();
  await expect(stageArtifact(join(f.directory, f.filename), join(f.directory, 'identity.json'), f.options)).rejects.toThrow(/approved app key/);
  await writeFile(join(f.directory, 'identity.json'), JSON.stringify({ ...f.identity, edSignature: Buffer.alloc(64).toString('base64') }));
  await expect(stageArtifact(join(f.directory, f.filename), join(f.directory, 'identity.json'), f.options, f.identity.publicKey)).rejects.toThrow(/signature/);
  expect(f.uploads).toHaveLength(0);
});
it('refuses altered bytes and over-cap files before storage writes', async () => {
  const f = await fixture();
  await writeFile(join(f.directory, f.filename), 'changed bytes');
  const stage = () => stageArtifact(join(f.directory, f.filename), join(f.directory, 'identity.json'), f.options, f.identity.publicKey);
  await expect(stage()).rejects.toThrow(/mismatch/);
  const { truncate } = await import('node:fs/promises');
  await truncate(join(f.directory, f.filename), 50 * 1024 * 1024 + 1);
  await expect(stage()).rejects.toThrow(/50 MB/);
  expect(f.uploads).toHaveLength(0);
});
it('treats successful uploads with failed public retrieval as incomplete staging', async () => {
  const f = await fixture();
  const fetcher: typeof fetch = async (input, init) => String(input).includes('/object/public/updates/')
    ? new Response('wrong bytes') : f.options.fetch(input, init);
  await expect(stageArtifact(join(f.directory, f.filename), join(f.directory, 'identity.json'), { ...f.options, fetch: fetcher }, f.identity.publicKey)).rejects.toThrow(/mismatch/);
});
it('binds dev to local dev credentials, ignores production shell values and refuses swapped projects', async () => {
  const { targetCredentials, PROJECTS } = await import('./stage-release.ts');
  const dev = { SUPABASE_URL: PROJECTS.dev, SUPABASE_SECRET_KEY: 'dev-secret' };
  const prod = { SUPABASE_URL: PROJECTS.prod, SUPABASE_SECRET_KEY: 'prod-secret' };
  expect(targetCredentials('dev', prod, dev)).toEqual({ supabaseUrl: PROJECTS.dev, key: 'dev-secret' });
  expect(() => targetCredentials('dev', prod, prod)).toThrow(/target mismatch/);
  expect(() => targetCredentials('prod', dev, dev)).toThrow(/target mismatch/);
  expect(() => targetCredentials('test', dev, dev)).toThrow(/explicit/);
});
it('does not stage private bytes when the public upload fails, and a later retry succeeds', async () => {
  const f = await fixture(); let fail = true;
  const fetcher: typeof fetch = async (input, init) => fail && init?.method === 'POST' && String(input).includes('/object/updates/')
    ? new Response('', { status: 503 }) : f.options.fetch(input, init);
  const stage = () => stageArtifact(join(f.directory, f.filename), join(f.directory, 'identity.json'), { ...f.options, fetch: fetcher }, f.identity.publicKey);
  await expect(stage()).rejects.toThrow(/retrieval/);
  expect(f.objects.size).toBe(0);
  fail = false;
  await stage();
  expect(f.objects.size).toBe(2);
});
it('rejects an external private signed URL without sending it any request', async () => {
  const f = await fixture();
  const fetcher: typeof fetch = async (input, init) => {
    expect(String(input)).not.toContain('external.example');
    return init?.method === 'POST' && String(input).includes('/object/sign/')
      ? Response.json({ signedURL: 'https://external.example/capture' }) : f.options.fetch(input, init);
  };
  await expect(stageArtifact(join(f.directory, f.filename), join(f.directory, 'identity.json'), { ...f.options, fetch: fetcher }, f.identity.publicKey)).rejects.toThrow(/unexpected URL/);
});
it('requires a conclusive anonymous private-download refusal', async () => {
  const f = await fixture();
  const fetcher: typeof fetch = async (input, init) => String(input).includes('/object/public/releases/')
    ? new Response('', { status: 503 }) : f.options.fetch(input, init);
  await expect(stageArtifact(join(f.directory, f.filename), join(f.directory, 'identity.json'), { ...f.options, fetch: fetcher }, f.identity.publicKey)).rejects.toThrow(/private/);
});
it.each([
  { version: '2147483648.0.0', build: '5' },
  { version: '0.10.0', build: '9223372036854775808' },
])('enforces website database version/build limits before uploading: %j', async ({ version, build }) => {
  const f = await fixture(); const filename = `CacheDrop-${version}.dmg`;
  await writeFile(join(f.directory, filename), f.body);
  await writeFile(join(f.directory, 'identity.json'), JSON.stringify({ ...f.identity, version, build, filename,
    url: `${f.options.supabaseUrl}/storage/v1/object/public/updates/${version}/${filename}` }));
  await expect(stageArtifact(join(f.directory, filename), join(f.directory, 'identity.json'), f.options, f.identity.publicKey)).rejects.toThrow(/limits/);
  expect(f.uploads).toHaveLength(0);
});
