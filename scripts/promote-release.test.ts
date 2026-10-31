import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { promoteRelease, targetFeedUrl } from './promote-release.ts';
import type { ArtifactIdentity } from './stage-release.ts';

const hash = (body: string | Uint8Array) => createHash('sha256').update(body).digest('hex');
const notes = '<p>Reviewed release notes.</p>';
const body = new Uint8Array([1, 2, 3]);
const identity: ArtifactIdentity = { version: '1.0.0', build: '5', filename: 'CacheDrop-1.0.0.dmg', length: 3,
  sha256: hash(body), edSignature: 'signature', publicKey: 'public', bundleID: 'com.patrickbourget.CacheDrop',
  teamID: '8F5K2ZRP5T', commit: 'a'.repeat(40), releaseNotesSHA256: hash(notes),
  url: 'https://dev.supabase.co/storage/v1/object/public/updates/1.0.0/CacheDrop-1.0.0.dmg' };
const feed = `<?xml version="1.0"?><rss xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle"><channel><item>
<sparkle:version>5</sparkle:version><sparkle:shortVersionString>1.0.0</sparkle:shortVersionString>
<description><![CDATA[${notes}]]></description><enclosure url="${identity.url}" length="3" sparkle:edSignature="signature"/>
</item></channel></rss>`;
function harness() {
  const calls: string[] = [];
  return { calls, deps: {
    feedUrl: 'https://acceptance.vercel.app/updates/appcast.xml',
    verifyArtifacts: async () => { calls.push('both downloads verified'); },
    updateLatest: async () => { calls.push('website latest'); },
    publishFeed: async () => { calls.push('appcast'); },
    fetch: async (url: string | URL | Request) => {
      calls.push(String(url));
      return new Response(String(url).endsWith('.xml') ? feed : body);
    },
  } };
}

describe('explicit staged release promotion', () => {
  it('verifies both download paths, advances website latest, then publishes and verifies feed last', async () => {
    const h = harness();
    await promoteRelease(identity, feed, notes, h.deps);
    expect(h.calls).toEqual(['both downloads verified', 'website latest', 'appcast',
      h.deps.feedUrl, identity.url]);
  });
});

describe('Sparkle RSS structure is validated before promotion', () => {
  it.each([
    feed.replace('<rss ', '<wrong-root ').replace('</rss>', '</wrong-root>'),
    feed.replace('<channel>', '<other>').replace('</channel>', '</other>'),
    feed.replace('<channel>', '<channel></channel><channel>'),
    feed.replace('<sparkle:version>5</sparkle:version>', '<sparkle:version>5</sparkle:version><sparkle:version>999</sparkle:version>'),
    feed.replace('<sparkle:shortVersionString>1.0.0</sparkle:shortVersionString>', '<sparkle:shortVersionString>1.0.0</sparkle:shortVersionString><sparkle:shortVersionString>9.0.0</sparkle:shortVersionString>'),
    feed.replace('</description>', '</description><description>Different notes</description>'),
    feed.replace('<item>', '<wrapper><item>').replace('</item>', '</item></wrapper>'),
  ])('refuses wrong roots, misplaced items and duplicate metadata before changing latest', async (xml) => {
    const h = harness();
    await expect(promoteRelease(identity, xml, notes, h.deps)).rejects.toThrow('not attempted');
    expect(h.calls).toEqual([]);
  });
  it('keeps production and isolated preview feed addresses separate', () => {
    expect(() => targetFeedUrl('dev', 'https://cachedrop.io/updates/appcast.xml')).toThrow();
    expect(() => targetFeedUrl('prod', 'https://acceptance.vercel.app/updates/appcast.xml')).toThrow();
    expect(targetFeedUrl('prod', 'https://cachedrop.io/updates/appcast.xml')).toBe('https://cachedrop.io/updates/appcast.xml');
  });
});

describe('promotion failures and retry state', () => {
  it('cannot advance either latest or feed when either download verification fails', async () => {
    const h = harness();
    h.deps.verifyArtifacts = async () => { throw new Error('private retrieval mismatch'); };
    await expect(promoteRelease(identity, feed, notes, h.deps)).rejects.toThrow('website latest not attempted; appcast not attempted');
    expect(h.calls).toEqual([]);
  });
  it('never publishes a feed after the website database fails', async () => {
    const h = harness();
    h.deps.updateLatest = async () => { throw new Error('database unavailable'); };
    await expect(promoteRelease(identity, feed, notes, h.deps)).rejects.toThrow('website latest unconfirmed; appcast not attempted');
    expect(h.calls).toEqual(['both downloads verified']);
  });
  it('retries the same artifact after website latest advances and feed publication fails', async () => {
    const h = harness();
    const published = new Set<string>();
    h.deps.updateLatest = async () => { published.add(identity.version); h.calls.push('website latest'); };
    h.deps.publishFeed = async () => { throw new Error('feed database unavailable'); };
    await expect(promoteRelease(identity, feed, notes, h.deps)).rejects.toThrow('website latest complete; appcast unconfirmed');
    h.deps.publishFeed = async () => { h.calls.push('appcast'); };
    await promoteRelease(identity, feed, notes, h.deps);
    expect(published.size).toBe(1);
    expect(h.calls.slice(-5)).toEqual(['both downloads verified', 'website latest', 'appcast', h.deps.feedUrl, identity.url]);
  });
  it('reports completed state when served canonical feed verification fails', async () => {
    const h = harness();
    h.deps.fetch = async () => new Response('<rss/>');
    await expect(promoteRelease(identity, feed, notes, h.deps)).rejects.toThrow('website latest complete; appcast published; served verification pending');
  });
  it('verifies served enclosure bytes again after the feed is published', async () => {
    const h = harness();
    h.deps.fetch = async (url) => new Response(String(url).endsWith('.xml') ? feed : new Uint8Array([9]));
    await expect(promoteRelease(identity, feed, notes, h.deps)).rejects.toThrow('Served immutable enclosure does not match');
  });
  it.each([
    feed.replace('length="3"', 'length="4"'), feed.replace('>5<', '>6<'),
    feed.replace(identity.url, 'https://wrong.example/CacheDrop-1.0.0.dmg'),
    feed.replace('edSignature="signature"', 'edSignature="different"'),
    feed.replace('>1.0.0<', '>0.9.9<'), feed.replace(notes, '<p>Unreviewed.</p>'),
  ])('refuses mismatched feed metadata before changing latest', async (xml) => {
    const h = harness();
    await expect(promoteRelease(identity, xml, notes, h.deps)).rejects.toThrow('not attempted');
    expect(h.calls).toEqual([]);
  });
});
