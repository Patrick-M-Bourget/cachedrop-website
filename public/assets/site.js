/* CacheDrop site behaviour: feedback modal and copy buttons. No dependencies. */
(function () {
  'use strict';

  // The Vercel function that saves feedback and files it as an issue (api/feedback.ts).
  var FEEDBACK_ENDPOINT = window.CACHEDROP_FEEDBACK_ENDPOINT || '/api/feedback';

  // Feedback modal
  var scrim = document.getElementById('feedback');
  if (scrim) {
    var form = scrim.querySelector('[data-fb-form]');
    var done = scrim.querySelector('[data-fb-done]');
    var error = scrim.querySelector('[data-fb-error]');
    var submit = form.querySelector('[type=submit]');
    var check = form.querySelector('[data-bot-check]');
    var bot = window.CacheDropBotCheck; // /assets/bot-check.js, loaded just before this file
    var rating = null;
    var lastFocus = null;

    function open(e) {
      if (e) e.preventDefault();
      lastFocus = document.activeElement;
      form.hidden = false; done.hidden = true; error.hidden = true;
      scrim.hidden = false;
      document.documentElement.style.overflow = 'hidden';
      bot.prepare(check); // Cloudflare's script loads only now (Decision 12)
      var first = scrim.querySelector('.fb-emoji');
      if (first) first.focus();
    }
    function close() {
      scrim.hidden = true;
      document.documentElement.style.overflow = '';
      if (location.hash === '#feedback') history.replaceState(null, '', location.pathname + location.search);
      if (lastFocus) lastFocus.focus();
    }
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-feedback]');
      if (t) open(e);
    });
    scrim.addEventListener('click', function (e) {
      if (e.target === scrim || e.target.closest('[data-fb-close]')) close();
      var r = e.target.closest('[data-rating]');
      if (r) {
        rating = r.getAttribute('data-rating');
        scrim.querySelectorAll('[data-rating]').forEach(function (b) { b.setAttribute('aria-pressed', b === r ? 'true' : 'false'); });
      }
    });
    document.addEventListener('keydown', function (e) {
      if (scrim.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') { // keep focus inside the dialog
        var f = Array.prototype.filter.call(scrim.querySelectorAll('button, input, textarea, a[href]'), function (el) { return el.offsetParent !== null; });
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var message = form.message.value.trim();
      if (!message && !rating) {
        error.textContent = scrim.getAttribute('data-msg-empty');
        error.hidden = false;
        return;
      }
      error.hidden = true;
      var payload = {
        rating: rating,
        email: form.email.value.trim(),
        message: message,
        // A token page's path holds a live download link: send it as /download/[token]/.
        page: location.pathname.replace(/^(\/fr)?\/download\/[^/]+(\/.*)?$/, '$1/download/[token]/'),
        specs: form.includeSpecs.checked ? { userAgent: navigator.userAgent, platform: navigator.platform, language: navigator.language } : null
      };
      submit.disabled = true;
      var NOT_SENT = scrim.getAttribute('data-msg-failed');
      function fail(message) { error.textContent = message; error.hidden = false; }
      bot.token(check)
        .then(function (token) {
          payload.turnstile = token;
          return fetch(FEEDBACK_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
            .then(function (res) {
              bot.reset(check); // a token works once
              if (res.ok) {
                form.hidden = true; done.hidden = false; form.reset(); rating = null;
                scrim.querySelectorAll('[data-rating]').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
                return;
              }
              return res.json().catch(function () { return {}; }).then(function (body) { fail(bot.message(check, res, body) || NOT_SENT); });
            }, function () { bot.reset(check); fail(NOT_SENT); });
        }, function () { fail(bot.failed(check)); })
        .then(function () { submit.disabled = false; });
    });
    if (location.hash === '#feedback') open();
  }

  // Copy buttons in code blocks. The button's own label comes back after "Copied" (data-copied).
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-copy]');
    if (!b) return;
    var text = b.getAttribute('data-copy');
    var label = b.getAttribute('data-label') || b.textContent;
    b.setAttribute('data-label', label);
    function ok() { b.textContent = b.getAttribute('data-copied'); setTimeout(function () { b.textContent = label; }, 1600); }
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(ok, function () {});
  });
})();
