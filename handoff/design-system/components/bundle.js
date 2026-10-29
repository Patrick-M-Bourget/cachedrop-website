/* @ds-bundle: {"format":4,"namespace":"CacheDrop","components":[{"name":"Button"},{"name":"IconButton"},{"name":"ArrowLink"},{"name":"Icon"},{"name":"Logo"},{"name":"Tag"},{"name":"StatusPill"},{"name":"Chip"},{"name":"InlineCode"},{"name":"CodeBlock"},{"name":"IconTile"},{"name":"FeatureCard"},{"name":"HowToPanel"},{"name":"SectionHeader"},{"name":"Breadcrumb"},{"name":"TableOfContents"},{"name":"FAQList"},{"name":"StepList"},{"name":"Callout"},{"name":"DataTable"},{"name":"TextField"},{"name":"TextArea"},{"name":"Checkbox"},{"name":"RatingScale"},{"name":"Modal"},{"name":"FeedbackForm"},{"name":"NavBar"},{"name":"Footer"},{"name":"MacWindow"},{"name":"StorageBar"},{"name":"ReviewRow"}]} */
(function () {
  var R = window.React;
  var h = R.createElement;
  var ICONS = {"download": ["M12 4v11", "M7 10l5 5 5-5", "M5 20h14"], "arrow-right": ["M5 12h14", "M13 6l6 6-6 6"], "chevron-right": ["M9 6l6 6-6 6"], "terminal": ["M6 5h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3z", "M7 10l3 2-3 2", "M13 15h4"], "film": ["M6 5h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3z", "M10 9.5v5l4.5-2.5z"], "drive": ["M6 7h12a3 3 0 0 1 3 3v4a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-4a3 3 0 0 1 3 -3z", "M11 12h6", "M7 12h.01"], "sparkle": ["M12 4l1.8 4.2L18 10l-4.2 1.8L12 16l-1.8-4.2L6 10l4.2-1.8z"], "list": ["M9 7h11", "M9 12h11", "M9 17h11", "M4.5 7h.01", "M4.5 12h.01", "M4.5 17h.01"], "trend": ["M4 17l5-5 4 3 7-8"], "clock": ["M20 12a8 8 0 1 1 -16 0a8 8 0 1 1 16 0z", "M12 8v4l3 2"], "folder": ["M3 7.5A1.5 1.5 0 0 1 4.5 6H9l2 2h8.5A1.5 1.5 0 0 1 21 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"], "laptop": ["M6.5 5h11.0a1.5 1.5 0 0 1 1.5 1.5v7.0a1.5 1.5 0 0 1 -1.5 1.5h-11.0a1.5 1.5 0 0 1 -1.5 -1.5v-7.0a1.5 1.5 0 0 1 1.5 -1.5z", "M3 19h18"], "box": ["M4 8l8-4 8 4v8l-8 4-8-4z", "M4 8l8 4 8-4", "M12 12v8"], "close": ["M6 6l12 12", "M18 6L6 18"], "check": ["M5 12.5l4.5 4.5L19 7.5"], "copy": ["M11 9h7a2 2 0 0 1 2 2v7a2 2 0 0 1 -2 2h-7a2 2 0 0 1 -2 -2v-7a2 2 0 0 1 2 -2z", "M15 5H7a2 2 0 0 0-2 2v8"], "message": ["M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-9l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"], "trash": ["M4 7h16", "M9 7V5h6v2", "M6 7l1 12h10l1-12"], "shield": ["M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z", "M9 12l2 2 4-4"]};
  var DROP = "M533.57 282.41 C520.43 265.84 503.57 265.84 490.43 282.41 C442.64 342.71 332 492.78 332 590 C332 689 413 768 512 768 C611 768 692 689 692 590 C692 492.78 581.36 342.71 533.57 282.41 Z M451.68 564.32 L488 600.64 L576.32 512.32 A25 25 0 0 1 611.68 547.68 L505.68 653.68 A25 25 0 0 1 470.32 653.68 L416.32 599.68 A25 25 0 0 1 451.68 564.32 Z";

  function cx() { return Array.prototype.filter.call(arguments, Boolean).join(' '); }
  function omit(p, keys) { var o = {}; for (var k in p) { if (Object.prototype.hasOwnProperty.call(p, k) && keys.indexOf(k) < 0) o[k] = p[k]; } return o; }
  function kids(list) { return list.filter(function (x) { return x !== null && x !== undefined && x !== false; }); }

  function Icon(p) {
    var d = ICONS[p.name] || [];
    var s = p.size || 18;
    var a11y = p.label ? { role: 'img', 'aria-label': p.label } : { 'aria-hidden': 'true' };
    return h('svg', Object.assign({ width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: p.strokeWidth || (s >= 20 ? 1.6 : 1.8), strokeLinecap: 'round', strokeLinejoin: 'round', className: cx('cd-icon', p.className), style: p.style }, a11y),
      d.map(function (x, i) { return h('path', { key: i, d: x }); }));
  }
  Icon.names = Object.keys(ICONS);

  function Logo(p) {
    var s = p.size || 18;
    var inner = [
      h('svg', { key: 'm', width: Math.round(s * 372 / 510), height: s, viewBox: '326 264 372 510', 'aria-hidden': 'true', className: 'cd-icon' }, h('path', { d: DROP, fill: 'currentColor', fillRule: 'evenodd' })),
      p.markOnly ? null : h('span', { key: 'n', className: 'cd-logo__name' }, 'CacheDrop'),
      p.beta ? h(Tag, { key: 't' }, 'Beta') : null
    ];
    var props = { className: cx('cd-logo', p.className) };
    if (p.href) return h('a', Object.assign(props, { href: p.href, 'aria-label': 'CacheDrop home' }), kids(inner));
    return h('span', props, kids(inner));
  }

  function Button(p) {
    var v = p.variant || 'primary', s = p.size || 'md', shape = p.shape || 'pill';
    var cls = cx('cd-btn', 'cd-btn--' + v, 'cd-btn--' + s, 'cd-btn--' + shape, p.className);
    var inner = kids([
      p.icon ? h(Icon, { key: 'i', name: p.icon, size: s === 'sm' ? 14 : 18 }) : null,
      h('span', { key: 'l' }, p.children),
      p.iconEnd ? h(Icon, { key: 'e', name: p.iconEnd, size: s === 'sm' ? 14 : 16 }) : null
    ]);
    var rest = omit(p, ['variant', 'size', 'shape', 'icon', 'iconEnd', 'className', 'children']);
    if (p.href) return h('a', Object.assign({}, rest, { className: cls }), inner);
    return h('button', Object.assign({ type: 'button' }, rest, { className: cls }), inner);
  }

  function IconButton(p) {
    var rest = omit(p, ['icon', 'label', 'className', 'size']);
    var inner = h(Icon, { name: p.icon, size: p.size || 16, strokeWidth: 2 });
    var props = Object.assign({}, rest, { className: cx('cd-iconbtn', p.className), 'aria-label': p.label });
    if (p.href) return h('a', props, inner);
    return h('button', Object.assign({ type: 'button' }, props), inner);
  }

  function ArrowLink(p) {
    var rest = omit(p, ['tone', 'size', 'className', 'children', 'arrow']);
    return h('a', Object.assign({}, rest, { className: cx('cd-link', p.tone === 'ink' && 'cd-link--ink', p.size === 'lg' && 'cd-link--lg', p.className) }),
      p.children, p.arrow === false ? null : h(Icon, { name: 'arrow-right', size: 14, strokeWidth: 2 }));
  }

  function Tag(p) { return h('span', { className: cx('cd-tag', p.className) }, p.children); }

  function StatusPill(p) {
    var tone = p.tone || 'neutral';
    return h('span', { className: cx('cd-pill', tone !== 'neutral' && 'cd-pill--' + tone, p.className) },
      p.dot ? h('span', { className: cx('cd-dot', p.dot !== 'success' && p.dot !== true && 'cd-dot--' + p.dot), 'aria-hidden': 'true' }) : null,
      h('span', null, p.children));
  }

  function Chip(p) { return h('span', { className: cx('cd-chip', p.className) }, p.children); }
  function InlineCode(p) { return h('code', { className: cx('cd-code', p.className) }, p.children); }

  function CodeBlock(p) {
    var st = R.useState(false), copied = st[0], setCopied = st[1];
    var timer = R.useRef(null);
    function copy() {
      try { if (navigator.clipboard) navigator.clipboard.writeText(p.code).catch(function () {}); } catch (e) {}
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(function () { setCopied(false); }, 1600);
    }
    return h('div', { className: cx('cd-codeblock', p.className) },
      h('div', { className: 'cd-codeblock__bar' },
        h('span', null, p.label || 'Terminal'),
        p.copyable === false ? null : h('button', { type: 'button', className: 'cd-copy', onClick: copy, 'data-copied': copied ? 'true' : 'false', 'aria-live': 'polite' }, copied ? 'Copied' : (p.copyLabel || 'Copy'))),
      h('pre', null, h('code', null, p.code)));
  }

  function IconTile(p) {
    var size = p.size || 'md';
    return h('span', { className: cx('cd-tile', 'cd-tile--' + size, p.tone && 'cd-tile--' + p.tone, p.className), 'aria-hidden': 'true' },
      h(Icon, { name: p.icon, size: size === 'sm' ? 18 : size === 'lg' ? 26 : 22 }));
  }

  function FeatureCard(p) {
    var H = 'h' + (p.headingLevel || 3);
    return h('article', { id: p.id, className: cx('cd-card', p.className) },
      p.icon ? h(IconTile, { icon: p.icon }) : null,
      h('div', { className: 'cd-card__main' },
        h(H, { className: 'cd-card__title' }, p.title),
        h('p', { className: 'cd-card__body' }, p.children)),
      p.chips && p.chips.length ? h('div', { className: 'cd-chips cd-card__chips' }, p.chips.map(function (c, i) { return h(Chip, { key: i }, c); })) : null,
      p.link ? h(ArrowLink, { href: p.link.href }, p.link.label) : null);
  }

  function HowToPanel(p) {
    var H = 'h' + (p.headingLevel || 3);
    return h('div', { className: cx('cd-panel', p.variant === 'fill' ? 'cd-panel--fill' : 'cd-panel--outline', p.className) },
      h(H, { className: 'cd-panel__title' }, p.title),
      p.children,
      p.note ? h('p', { className: 'cd-panel__note' }, p.note) : null,
      p.link ? h(ArrowLink, { href: p.link.href, size: 'lg', style: { marginTop: 'auto' } }, p.link.label) : null);
  }

  function SectionHeader(p) {
    var H = 'h' + (p.level || 2);
    return h('div', { className: cx('cd-sh', 'cd-sh--' + (p.size || 'lg'), p.align === 'center' && 'cd-sh--center', p.className) },
      p.eyebrow ? h('p', { className: 'cd-eyebrow' }, p.eyebrow) : null,
      h(H, { className: 'cd-sh__title' }, p.title),
      p.lede ? h('p', { className: 'cd-sh__lede' }, p.lede) : null);
  }

  function Breadcrumb(p) {
    var items = p.items || [];
    var out = [];
    items.forEach(function (it, i) {
      var last = i === items.length - 1;
      out.push(h('li', { key: 'i' + i, 'aria-current': last ? 'page' : undefined }, last || !it.href ? it.label : h('a', { href: it.href }, it.label)));
      if (!last) out.push(h('li', { key: 's' + i, 'aria-hidden': 'true', style: { display: 'flex' } }, h(Icon, { name: 'chevron-right', size: 12, strokeWidth: 2 })));
    });
    return h('nav', { 'aria-label': 'Breadcrumb', className: cx('cd-crumbs', p.className) }, h('ol', null, out));
  }

  function TableOfContents(p) {
    return h('nav', { 'aria-label': p.title || 'On this page', className: cx('cd-toc', p.className) },
      h('p', { className: 'cd-eyebrow' }, p.title || 'On this page'),
      h('ol', null, (p.items || []).map(function (it, i) { return h('li', { key: i }, h('a', { href: it.href }, it.label)); })));
  }

  function FAQList(p) {
    var H = 'h' + (p.headingLevel || 3);
    return h('div', { className: cx('cd-faq', p.variant === 'article' && 'cd-faq--article', p.className) },
      (p.items || []).map(function (it, i) {
        return h('div', { key: i, className: 'cd-faq__item' }, h(H, { className: 'cd-faq__q' }, it.q), h('p', { className: 'cd-faq__a' }, it.a));
      }));
  }

  function StepList(p) {
    var variant = p.variant || 'rows';
    var H = 'h' + (p.headingLevel || 3);
    return h('ol', { className: cx('cd-steps', 'cd-steps--' + variant, p.className) },
      (p.items || []).map(function (it, i) {
        var n = String((p.start || 1) + i);
        if (n.length < 2) n = '0' + n;
        var text = h('div', { key: 't' }, h(H, { className: 'cd-step__title' }, it.title), it.body ? h('p', { className: 'cd-step__body' }, it.body) : null);
        return h('li', { key: i, className: 'cd-step' }, h('span', { className: 'cd-step__n', 'aria-hidden': 'true' }, n), variant === 'cards' ? [h(H, { key: 'h', className: 'cd-step__title' }, it.title), it.body ? h('p', { key: 'b', className: 'cd-step__body' }, it.body) : null] : text);
      }));
  }

  function Callout(p) {
    return h('aside', { className: cx('cd-callout', p.className) },
      h('div', null, p.eyebrow ? h('p', { className: 'cd-eyebrow' }, p.eyebrow) : null, h('p', { className: 'cd-callout__title' }, p.title)),
      p.link ? h(ArrowLink, { href: p.link.href, size: 'lg' }, p.link.label) : null);
  }

  function DataTable(p) {
    var mono = p.monoColumns || [];
    return h('div', { className: cx('cd-table-wrap', p.className) },
      h('table', { className: 'cd-table' },
        p.caption ? h('caption', { className: 'cd-sr' }, p.caption) : null,
        h('thead', null, h('tr', null, (p.columns || []).map(function (c, i) { return h('th', { key: i, scope: 'col' }, c); }))),
        h('tbody', null, (p.rows || []).map(function (row, r) {
          return h('tr', { key: r }, row.map(function (cell, c) {
            if (c === 0) return h('th', { key: c, scope: 'row' }, cell);
            return h('td', { key: c, className: mono.indexOf(c) >= 0 ? 'cd-mono' : undefined }, cell);
          }));
        }))));
  }

  var TextField = R.forwardRef(function TextField(p, ref) {
    var rest = omit(p, ['label', 'optional', 'error', 'className']);
    return h('div', { className: cx('cd-field', p.className) },
      h('label', { htmlFor: p.id, className: 'cd-field__label' }, p.label, p.optional ? h('span', { className: 'cd-field__opt' }, ' (optional)') : null),
      h('input', Object.assign({ type: 'text' }, rest, { ref: ref, className: 'cd-input', 'aria-invalid': p.error ? 'true' : undefined, 'aria-describedby': p.error ? p.id + '-err' : undefined })),
      p.error ? h('span', { id: p.id + '-err', className: 'cd-field__error' }, p.error) : null);
  });

  var TextArea = R.forwardRef(function TextArea(p, ref) {
    var rest = omit(p, ['label', 'optional', 'monoHint', 'className']);
    return h('div', { className: cx('cd-field', p.className) },
      h('label', { htmlFor: p.id, className: 'cd-field__label' }, p.label, p.optional ? h('span', { className: 'cd-field__opt' }, ' (optional)') : null),
      h('textarea', Object.assign({}, rest, { ref: ref, className: cx('cd-input', 'cd-input--area', p.monoHint !== false && 'cd-input--mono-hint') })));
  });

  function Checkbox(p) {
    var rest = omit(p, ['label', 'hint', 'className']);
    return h('label', { htmlFor: p.id, className: cx('cd-check', p.className) },
      h('input', Object.assign({ type: 'checkbox' }, rest)),
      h('span', null, p.label, p.hint ? h('span', { className: 'cd-check__hint' }, ' ' + p.hint) : null));
  }

  var SCALE = [
    { id: 'angry', emoji: '😡', label: 'Very unhappy' },
    { id: 'meh', emoji: '😕', label: 'Unhappy' },
    { id: 'neutral', emoji: '😐', label: 'Neutral' },
    { id: 'happy', emoji: '🙂', label: 'Happy' },
    { id: 'love', emoji: '😍', label: 'Love it' }
  ];

  function RatingScale(p) {
    var st = R.useState(p.defaultValue || null), inner = st[0], setInner = st[1];
    var value = p.value !== undefined ? p.value : inner;
    return h('fieldset', { className: cx('cd-rating', p.className) },
      h('legend', null, p.label || 'Your rating'),
      h('div', { className: 'cd-rating__row' }, SCALE.map(function (s) {
        return h('button', { key: s.id, type: 'button', className: 'cd-rating__btn', 'aria-label': s.label, 'aria-pressed': value === s.id ? 'true' : 'false',
          onClick: function () { setInner(s.id); if (p.onChange) p.onChange(s.id); } }, s.emoji);
      })));
  }
  RatingScale.values = SCALE.map(function (s) { return s.id; });

  function Modal(p) {
    if (p.open === false) return null;
    var titleId = p.titleId || 'cd-modal-title';
    return h('div', { className: cx('cd-scrim', p.inline && 'cd-scrim--inline'), onClick: function (e) { if (e.target === e.currentTarget && p.onClose) p.onClose(); } },
      h('div', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, className: cx('cd-modal', p.className) },
        h('div', { className: 'cd-modal__head' },
          h('div', null, h('h2', { id: titleId, className: 'cd-modal__title' }, p.title), p.subtitle ? h('p', { className: 'cd-modal__sub' }, p.subtitle) : null),
          p.onClose || p.closeHref ? h(IconButton, { icon: 'close', label: 'Close', onClick: p.onClose, href: p.closeHref }) : null),
        h('div', { className: 'cd-modal__body' }, p.children),
        p.footer ? h('div', { className: 'cd-modal__foot' }, p.footer) : null));
  }

  function FeedbackForm(p) {
    var s1 = R.useState(p.defaultRating || null), rating = s1[0], setRating = s1[1];
    var s2 = R.useState(true), specs = s2[0], setSpecs = s2[1];
    var s3 = R.useState(false), sent = s3[0], setSent = s3[1];
    var emailRef = R.useRef(null), notesRef = R.useRef(null);
    function submit() {
      var data = { rating: rating, email: emailRef.current ? emailRef.current.value : '', message: notesRef.current ? notesRef.current.value : '', includeSpecs: specs };
      if (p.onSubmit) p.onSubmit(data);
      setSent(true);
    }
    var body = sent
      ? h('div', { className: 'cd-done' },
          h('div', { className: 'cd-done__icon' }, h(Icon, { name: 'check', size: 24, strokeWidth: 2 })),
          h('p', { className: 'cd-done__title' }, 'Thanks, that helps.'),
          h('p', { className: 'cd-done__body' }, 'We read every note and use them to decide what to build next.'),
          h(Button, { variant: 'secondary', shape: 'rounded', size: 'md', onClick: p.onClose }, 'Back to CacheDrop'))
      : [
          h(RatingScale, { key: 'r', value: rating, onChange: setRating }),
          h(TextField, { key: 'e', id: 'cd-fb-email', label: 'Email', optional: true, type: 'email', placeholder: 'you@example.com', ref: emailRef }),
          h(TextArea, { key: 'n', id: 'cd-fb-notes', label: 'What should we change?', placeholder: 'Or report a bug… (Markdown supported)', ref: notesRef }),
          h(Checkbox, { key: 'c', id: 'cd-fb-specs', checked: specs, onChange: function () { setSpecs(!specs); }, label: 'Send anonymous system specs', hint: '(Mac model, macOS version)' })
        ];
    return h(Modal, { title: 'Give Fast Feedback', subtitle: 'How is CacheDrop working for you?', onClose: p.onClose, inline: p.inline, open: p.open,
      footer: sent ? null : [h(Button, { key: 'x', variant: 'secondary', shape: 'rounded', size: 'md', onClick: p.onClose }, 'Cancel'), h(Button, { key: 's', variant: 'primary', shape: 'rounded', size: 'md', onClick: submit }, 'Submit Feedback')] }, body);
  }

  var NAV_DEFAULT = [
    { id: 'developers', label: 'For Developers', href: '/clear-mac-developer-caches' },
    { id: 'creators', label: 'For Creators', href: '/clear-adobe-media-cache-mac' },
    { id: 'feedback', label: 'Provide Feedback', href: '#feedback' }
  ];

  function NavBar(p) {
    var links = p.links || NAV_DEFAULT;
    return h('header', { className: cx('cd-nav', p.className) },
      h('div', { className: 'cd-nav__inner' },
        h(Logo, { href: p.homeHref || '/', beta: p.beta !== false }),
        h('nav', { 'aria-label': 'Primary', className: 'cd-nav__links' }, links.map(function (l) {
          return h('a', { key: l.id || l.href, href: l.href, onClick: l.onClick, className: 'cd-navlink', 'aria-current': p.active && p.active === l.id ? 'page' : undefined }, l.label);
        })),
        h(Button, { size: 'sm', href: p.ctaHref || '/download' }, p.ctaLabel || 'Get Free Beta')));
  }

  var FOOTER_DEFAULT = [
    { title: 'Cleaning Guides', links: [{ label: 'Clear Developer Caches', href: '/clear-mac-developer-caches' }, { label: 'Clear Adobe Media Cache', href: '/clear-adobe-media-cache-mac' }] },
    { title: 'Product', links: [{ label: 'Overview', href: '/' }, { label: 'Download Free Beta', href: '/download' }, { label: 'Provide Feedback', href: '#feedback' }] },
    { title: 'Platform', items: ['Apple Silicon & Intel', 'macOS 14 Sonoma and later'] }
  ];

  function Footer(p) {
    var cols = p.columns || FOOTER_DEFAULT;
    return h('footer', { className: cx('cd-footer', p.className) },
      h('div', { className: 'cd-footer__inner' },
        h('div', { className: 'cd-footer__cols' },
          h('div', { className: 'cd-footer__col', style: { gap: '12px' } }, h(Logo, { size: 16 }), h('p', { className: 'cd-footer__blurb' }, p.blurb || 'A careful Mac storage cleaner for developer caches and creative render files.')),
          cols.map(function (c, i) {
            var inner = [h('h3', { key: 'h' }, c.title)].concat(
              (c.links || []).map(function (l, j) { return h('a', { key: 'l' + j, href: l.href }, l.label); }),
              (c.items || []).map(function (t, j) { return h('span', { key: 's' + j }, t); }));
            return h(c.links ? 'nav' : 'div', { key: i, className: 'cd-footer__col', 'aria-label': c.links ? c.title : undefined }, inner);
          })),
        h('div', { className: 'cd-footer__legal' }, h('span', null, p.legal || '© 2026 CacheDrop. Apple, Mac, and macOS are trademarks of Apple Inc.'), h('span', null, p.status || 'Public beta'))));
  }

  function MacWindow(p) {
    var side = p.sidebar;
    return h('figure', { className: cx('cd-window', p.className), 'data-theme': p.appearance === 'dark' ? 'dark' : p.appearance === 'light' ? 'light' : undefined, 'aria-label': p.label || 'The CacheDrop app', style: Object.assign({ margin: 0 }, p.style) },
      h('div', { className: 'cd-window__bar' },
        h('span', { className: 'cd-window__light', style: { background: 'var(--traffic-close)' } }),
        h('span', { className: 'cd-window__light', style: { background: 'var(--traffic-minimize)' } }),
        h('span', { className: 'cd-window__light', style: { background: 'var(--traffic-zoom)' } }),
        h('span', { className: 'cd-window__title' }, p.title || 'CacheDrop')),
      h('div', { className: 'cd-window__body' },
        side ? h('div', { className: 'cd-window__side' }, side.map(function (g, i) {
          return h('div', { key: i, className: 'cd-window__group' },
            g.label ? h('div', { className: 'cd-window__label' }, g.label) : null,
            g.items.map(function (it, j) { return h('div', { key: j, className: 'cd-window__row', 'aria-current': it.active ? 'page' : undefined }, h(Icon, { name: it.icon, size: 16 }), h('span', null, it.label)); }));
        })) : null,
        h('div', { className: 'cd-window__main' }, p.children)));
  }

  function StorageBar(p) {
    var pct = p.total ? Math.max(0, Math.min(100, (p.used / p.total) * 100)) : 0;
    var unit = p.unit || 'GB';
    return h('div', { className: cx('cd-bar', p.className) },
      h('div', { className: 'cd-bar__track', role: 'meter', 'aria-valuemin': 0, 'aria-valuemax': p.total, 'aria-valuenow': p.used, 'aria-label': p.label || 'Disk used' },
        h('div', { className: 'cd-bar__fill', style: { width: pct.toFixed(1) + '%' } })),
      p.meta === false ? null : h('div', { className: 'cd-bar__meta' }, h('span', null, p.used + ' ' + unit + ' used'), h('span', null, p.caption || 'Whole-disk capacity')));
  }

  function ReviewRow(p) {
    return h('div', { className: cx('cd-review', p.className) },
      h('div', { className: 'cd-review__lead' },
        h(IconTile, { icon: p.icon || 'terminal', size: 'sm', tone: p.tone }),
        h('div', { style: { minWidth: 0 } }, h('div', { className: 'cd-review__title' }, p.title), p.detail ? h('div', { className: 'cd-review__detail' }, p.detail) : null)),
      h('div', { className: 'cd-review__end' },
        h('div', { className: 'cd-review__size' }, p.size),
        h('button', { type: 'button', className: 'cd-review__action', onClick: p.onReview }, (p.actionLabel || 'Review files') + ' ›')));
  }

  var api = { Button: Button, IconButton: IconButton, ArrowLink: ArrowLink, Icon: Icon, Logo: Logo, Tag: Tag, StatusPill: StatusPill, Chip: Chip, InlineCode: InlineCode, CodeBlock: CodeBlock, IconTile: IconTile, FeatureCard: FeatureCard, HowToPanel: HowToPanel, SectionHeader: SectionHeader, Breadcrumb: Breadcrumb, TableOfContents: TableOfContents, FAQList: FAQList, StepList: StepList, Callout: Callout, DataTable: DataTable, TextField: TextField, TextArea: TextArea, Checkbox: Checkbox, RatingScale: RatingScale, Modal: Modal, FeedbackForm: FeedbackForm, NavBar: NavBar, Footer: Footer, MacWindow: MacWindow, StorageBar: StorageBar, ReviewRow: ReviewRow };
  window.CacheDrop = window.CacheDrop || {};
  Object.assign(window.CacheDrop, api);
})();
