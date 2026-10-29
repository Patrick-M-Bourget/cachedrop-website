/* CacheDrop site behaviour: feedback modal, copy buttons, download start. No dependencies. */
(function () {
  'use strict';

  // ---- Configuration: set these before launch -------------------------------------------
  // The Vercel function that saves feedback and files it as an issue (api/feedback.ts).
  var FEEDBACK_ENDPOINT = window.CACHEDROP_FEEDBACK_ENDPOINT || '/api/feedback';
  // The signed, notarized .dmg. The download page starts it on load.
  var DMG_URL = window.CACHEDROP_DMG_URL || '[DMG_URL]';
  // ---------------------------------------------------------------------------------------

  // Feedback modal
  var scrim = document.getElementById('feedback');
  if (scrim) {
    var form = scrim.querySelector('[data-fb-form]');
    var done = scrim.querySelector('[data-fb-done]');
    var error = scrim.querySelector('[data-fb-error]');
    var submit = form.querySelector('[type=submit]');
    var rating = null;
    var lastFocus = null;

    function open(e) {
      if (e) e.preventDefault();
      lastFocus = document.activeElement;
      form.hidden = false; done.hidden = true; error.hidden = true;
      scrim.hidden = false;
      document.documentElement.style.overflow = 'hidden';
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
        page: location.pathname,
        specs: form.includeSpecs.checked ? { userAgent: navigator.userAgent, platform: navigator.platform, language: navigator.language } : null
      };
      submit.disabled = true;
      fetch(FEEDBACK_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        .then(function (res) { if (!res.ok) throw new Error(res.status); })
        .then(function () { form.hidden = true; done.hidden = false; form.reset(); rating = null;
          scrim.querySelectorAll('[data-rating]').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); }); })
        .catch(function () { error.textContent = scrim.getAttribute('data-msg-failed'); error.hidden = false; })
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

  // Download page: start the .dmg and wire the retry link
  var retry = document.querySelector('[data-dmg]');
  if (retry && DMG_URL.charAt(0) !== '[') {
    retry.href = DMG_URL;
    setTimeout(function () { window.location.href = DMG_URL; }, 400);
  }
})();
