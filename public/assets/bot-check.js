/* Cloudflare Turnstile for the site's forms (Decision 12). No dependencies.
 * Each form holds a [data-bot-check] element (src/components/BotCheck.astro). Cloudflare's script
 * loads only when a form calls prepare() or token(), so pages nobody sends a form from never fetch it.
 *   CacheDropBotCheck.prepare(el)         start the check early (page load, modal open)
 *   CacheDropBotCheck.token(el)           a promise of a token; rejects when the check can't pass
 *   CacheDropBotCheck.reset(el)           after each answer from the server: tokens are single use
 *   CacheDropBotCheck.message(el, res, body)  the copy for a bot-check or rate-limit refusal, or null
 *   CacheDropBotCheck.failed(el)          the copy for a check that couldn't pass in the browser
 */
(function () {
  'use strict';
  if (window.CacheDropBotCheck) return;

  var API = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=cacheDropTurnstileReady';
  var loading = null;

  function load() {
    if (loading) return loading;
    loading = new Promise(function (resolve, reject) {
      if (window.turnstile) return resolve(window.turnstile);
      var timer = setTimeout(function () { loading = null; reject(new Error('Turnstile did not load')); }, 15000);
      window.cacheDropTurnstileReady = function () { clearTimeout(timer); resolve(window.turnstile); };
      var s = document.createElement('script');
      s.src = API;
      s.async = true;
      s.onerror = function () { clearTimeout(timer); loading = null; reject(new Error('Turnstile did not load')); };
      document.head.appendChild(s);
    });
    return loading;
  }

  function state(el) {
    return el.cacheDropBotCheck || (el.cacheDropBotCheck = { id: null, token: null, failed: false, started: false, waiters: [] });
  }
  function settle(st) {
    var waiting = st.waiters;
    st.waiters = [];
    waiting.forEach(function (check) { check(); });
  }
  function fail(st) { st.token = null; st.failed = true; settle(st); }

  function prepare(el) {
    var st = state(el);
    if (st.started) return;
    st.started = true;
    load().then(function (turnstile) {
      st.id = turnstile.render(el, {
        sitekey: el.getAttribute('data-sitekey'),
        action: el.getAttribute('data-action'),
        language: document.documentElement.lang || 'auto',
        // Invisible unless Cloudflare needs a click; then the box shows where the element sits.
        appearance: 'interaction-only',
        size: 'flexible',
        retry: 'never',
        callback: function (token) { st.token = token; st.failed = false; el.hidden = true; settle(st); },
        'expired-callback': function () { st.token = null; },
        'before-interactive-callback': function () { el.hidden = false; },
        'after-interactive-callback': function () { el.hidden = true; },
        'error-callback': function () { fail(st); return true; },
        'unsupported-callback': function () { fail(st); }
      });
    }, function () { st.started = false; fail(st); });
  }

  function reset(el) {
    var st = state(el);
    st.token = null;
    st.failed = false;
    if (st.id !== null && window.turnstile) window.turnstile.reset(st.id);
  }

  function token(el) {
    var st = state(el);
    if (st.failed) reset(el); // a fresh try for this send
    prepare(el);
    return new Promise(function (resolve, reject) {
      function check() {
        if (st.token) resolve(st.token);
        else if (st.failed) reject(new Error('bot check failed'));
        else st.waiters.push(check);
      }
      check();
    });
  }

  function failed(el) { return el.getAttribute('data-msg-failed'); }

  function message(el, res, body) {
    body = body || {};
    if (res.status === 403 && body.error === 'bot_check') return failed(el);
    if (res.status !== 429) return null;
    var seconds = Number(body.retryAfter || res.headers.get('Retry-After')) || 3600;
    var minutes = Math.max(1, Math.ceil(seconds / 60));
    var wait = minutes === 1 ? el.getAttribute('data-msg-minute') : el.getAttribute('data-msg-minutes').replace('{n}', minutes);
    return el.getAttribute('data-msg-limited').replace('{wait}', wait);
  }

  window.CacheDropBotCheck = { prepare: prepare, token: token, reset: reset, message: message, failed: failed };
})();
