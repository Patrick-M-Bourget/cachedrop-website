/* CacheDrop analytics setup (Decision 16). Runs before Vercel's /_vercel/insights/script.js,
   which every page loads after it. Vercel Web Analytics is cookieless; this file makes sure no
   download token reaches it: the page view's address and the referrer it reports are redacted.
   No dependencies; tests/analytics.spec.ts checks what Vercel's script sends. */
(function () {
  'use strict';

  var TOKEN = /^[A-Za-z0-9_-]{43}$/; // a download token (Decision 2), as vercel.json matches it
  var HAS_TOKEN = /[A-Za-z0-9_-]{43}/;

  /**
   * The address with any token-shaped path segment replaced by [token], the fragment dropped, and
   * only utm_* query parameters kept (none whose value looks like a token).
   * /download/<token>/ becomes /download/[token]/. Null if the address can't be parsed.
   */
  function redact(href) {
    var url;
    try { url = new URL(href, location.href); } catch (e) { return null; }
    url.pathname = url.pathname.split('/').map(function (s) { return TOKEN.test(s) ? '[token]' : s; }).join('/');
    var kept = new URLSearchParams();
    url.searchParams.forEach(function (value, key) {
      if (/^utm_/.test(key) && !HAS_TOKEN.test(value)) kept.append(key, value);
    });
    url.search = kept.toString();
    url.hash = '';
    return url.href;
  }

  // Vercel's script reads document.referrer when it sends a page view, and beforeSend can't
  // change that field, so redact it here. Same-site referrers are never sent, but redact them too.
  if (document.referrer) {
    var referrer = redact(document.referrer) || '';
    if (referrer !== document.referrer) Object.defineProperty(document, 'referrer', { value: referrer, configurable: true });
  }

  // The queue Vercel's script replays when it loads (the same one @vercel/analytics sets up).
  window.va = window.va || function () { (window.vaq = window.vaq || []).push([].slice.call(arguments)); };
  window.va('beforeSend', function (event) {
    var url = redact(event.url);
    if (!url) return null;
    var safe = {};
    for (var key in event) safe[key] = event[key];
    safe.url = url;
    return safe;
  });
})();
