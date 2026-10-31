// Explicit owner-run promotion: both immutable destinations first, website latest next, appcast last.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DOMParser, type Element } from '@xmldom/xmldom';
import { confirmProduction, loadArtifact, localEnvironment, targetCredentials, verifyStagedArtifact,
  type ArtifactIdentity } from './stage-release.ts';

const SPARKLE = 'http://www.andymatuschak.org/xml-namespaces/sparkle';
export const hash = (body: string | Uint8Array) => createHash('sha256').update(body).digest('hex');
export interface PromotionDeps {
  feedUrl: string;
  verifyArtifacts(identity: ArtifactIdentity): Promise<void>;
  updateLatest(identity: ArtifactIdentity): Promise<void>;
  publishFeed(identity: ArtifactIdentity, xml: string, sha256: string): Promise<void>;
  fetch: typeof fetch;
}

/** A malformed feed cannot change latest; use the already generated, reviewed artifact set. */
export function validateAppcast(xml: string, identity: ArtifactIdentity, notes: string) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Appcasts cannot contain document types or entities.');
  const document = new DOMParser({ onError: () => { throw new Error('Malformed appcast XML.'); } }).parseFromString(xml, 'application/xml');
  const direct = (parent: Element, name: string, namespace = '') => Array.from(parent.childNodes)
    .filter((node): node is Element => node.nodeType === 1)
    .filter(node => node.localName === name && (node.namespaceURI ?? '') === namespace);
  const only = (parent: Element, name: string, namespace = '') => {
    const matches = direct(parent, name, namespace);
    if (matches.length !== 1) throw new Error(`Appcast requires exactly one direct ${name} element.`);
    return matches[0];
  };
  const rss = document.documentElement;
  if (!rss || rss.tagName !== 'rss' || rss.namespaceURI) throw new Error('Appcast must be an RSS document.');
  const channel = only(rss, 'channel');
  const item = only(channel, 'item');
  if (document.getElementsByTagName('item').length !== 1) throw new Error('Appcast must contain exactly this full release.');
  const enclosure = only(item, 'enclosure');
  const build = only(item, 'version', SPARKLE).textContent;
  const version = only(item, 'shortVersionString', SPARKLE).textContent;
  const description = only(item, 'description').textContent;
  if (enclosure.getAttribute('url') !== identity.url
    || enclosure.getAttribute('length') !== String(identity.length)
    || enclosure.getAttributeNS(SPARKLE, 'edSignature') !== identity.edSignature
    || build !== identity.build || version !== identity.version
    || item.getElementsByTagNameNS(SPARKLE, 'deltas').length || item.getElementsByTagNameNS(SPARKLE, 'channel').length) {
    throw new Error('Appcast does not match the staged full stable DMG identity.');
  }
  if (hash(notes) !== identity.releaseNotesSHA256 || !notes.trim()
    || !(description ?? '').includes(notes.trim())) {
    throw new Error('Appcast or reviewed release notes do not match the artifact identity.');
  }
}

export async function promoteRelease(identity: ArtifactIdentity, xml: string, notes: string, deps: PromotionDeps) {
  let state = 'website latest not attempted; appcast not attempted';
  try {
    validateAppcast(xml, identity, notes);
    await deps.verifyArtifacts(identity);
    state = 'website latest unconfirmed; appcast not attempted';
    await deps.updateLatest(identity);
    state = 'website latest complete; appcast unconfirmed';
    await deps.publishFeed(identity, xml, hash(xml));
    state = 'website latest complete; appcast published; served verification pending';
    const served = await deps.fetch(deps.feedUrl, { cache: 'no-store', redirect: 'error' });
    if (!served.ok || hash(await served.text()) !== hash(xml)) throw new Error('Served canonical appcast does not match the promoted feed.');
    const enclosure = await deps.fetch(identity.url, { cache: 'no-store', redirect: 'error' });
    const body = new Uint8Array(await enclosure.arrayBuffer());
    if (!enclosure.ok || body.byteLength !== identity.length || hash(body) !== identity.sha256) {
      throw new Error('Served immutable enclosure does not match the promoted DMG.');
    }
  } catch (error) {
    throw new Error(`Promotion incomplete (${state}). ${error instanceof Error ? error.message : 'Operation failed.'} Retry this same staged artifact; do not rebuild or replace it.`);
  }
}

export function targetFeedUrl(target: string, value: string) {
  if (target !== 'dev' && target !== 'prod') throw new Error('Target must be explicit dev or prod.');
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/updates/appcast.xml'
    || (target === 'prod' ? value !== 'https://cachedrop.io/updates/appcast.xml'
      : !url.hostname.endsWith('.vercel.app') || url.hostname === 'cachedrop-website.vercel.app')) {
    throw new Error('Use the canonical production feed for prod, or an isolated HTTPS Vercel preview feed for dev.');
  }
  return value;
}

if (import.meta.main) {
  try {
    const [target, directory, feedUrl, ...extra] = process.argv.slice(2);
    if (!target || !directory || !feedUrl || extra.length) throw new Error('usage: scripts/promote-release.sh <dev|prod> ARTIFACT_DIRECTORY HTTPS_FEED_URL');
    const credentials = targetCredentials(target, process.env, localEnvironment());
    targetFeedUrl(target, feedUrl);
    const folder = resolve(directory);
    const identityPath = resolve(folder, 'release-identity.json');
    const source = JSON.parse(await readFile(identityPath, 'utf8'));
    const { identity } = await loadArtifact(resolve(folder, source.filename), identityPath);
    const xml = await readFile(resolve(folder, 'appcast.xml'), 'utf8');
    const notes = await readFile(resolve(folder, identity.filename.replace(/\.dmg$/, '.html')), 'utf8');
    if (target === 'prod' && !await confirmProduction('Promote website latest and appcast')) throw new Error('Not confirmed; nothing promoted.');
    const rpc = async (name: string, body: object) => {
      const response = await fetch(`${credentials.supabaseUrl}/rest/v1/rpc/${name}`, {
        method: 'POST', headers: { apikey: credentials.key, Authorization: `Bearer ${credentials.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(`${name} failed (HTTP ${response.status}); check identity/version/build and retry.`);
    };
    await promoteRelease(identity, xml, notes, {
      feedUrl, fetch,
      verifyArtifacts: (artifact) => verifyStagedArtifact(artifact, { ...credentials, fetch }),
      updateLatest: (artifact) => rpc('promote_staged_release', { p_identity: artifact }),
      publishFeed: (artifact, appcast, sha256) => rpc('promote_release_feed', { p_identity: artifact, p_appcast_xml: appcast, p_sha256: sha256 }),
    });
    console.log(`Promoted ${identity.version} (${identity.build}) to ${target}: website latest, then appcast; served feed and immutable enclosure verified.`);
  } catch (error) { console.error(error instanceof Error ? error.message : 'Promotion failed.'); process.exitCode = 1; }
}
