// The website's permanent public Sparkle feed. Promotion writes this only after website latest.
export interface PromotedFeed { xml: string; sha256: string }
export async function handleAppcast(request: Request, load: () => Promise<PromotedFeed | null>): Promise<Response> {
  try {
    const feed = await load();
    if (!feed) return new Response('No update feed has been promoted.', { status: 404, headers: { 'cache-control': 'no-store' } });
    const headers = { 'content-type': 'application/rss+xml; charset=utf-8', etag: `"${feed.sha256}"`,
      'cache-control': 'public, max-age=0, must-revalidate', 'cdn-cache-control': 'no-store' };
    if (request.headers.get('if-none-match') === headers.etag) return new Response(null, { status: 304, headers });
    return new Response(feed.xml, { headers });
  } catch {
    return new Response('Update feed is temporarily unavailable.', { status: 503, headers: { 'cache-control': 'no-store' } });
  }
}
