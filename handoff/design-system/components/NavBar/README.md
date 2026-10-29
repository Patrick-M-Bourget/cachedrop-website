# NavBar

The sticky, frosted top bar: logo with BETA tag left, three text links centred, the Get Free Beta pill right.

**Provide** `active` (the id of the current section, sets `aria-current`), and `links`, `homeHref`, `ctaHref` when the defaults don’t fit (`/clear-mac-developer-caches`, `/clear-adobe-media-cache-mac`, `#feedback`, `/download`).

- 52px tall, `glass` with `backdrop-nav` and a `glass-line` bottom border.
- Exactly three links: For Developers, For Creators, Provide Feedback. Links hide below 760px; the CTA stays.
- Provide Feedback opens the `FeedbackForm` modal; wire its `onClick`.
