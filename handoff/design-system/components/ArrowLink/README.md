# ArrowLink

A text link with a trailing arrow, for moving to another page (guides, related content) without the weight of a button.

**Provide** `href` and `children`. `size="lg"` (15px) in asides and panels; default 14px in cards. `tone="ink"` for quiet secondary links; `arrow={false}` to drop the arrow.

- Colour is `accent-text`, never `accent`: it passes 4.5:1 on `surface`, `surface-subtle` and `accent-soft`.
- Write the destination, not “Learn more”: “How to clear Adobe media cache”, “Read the developer guide”.
- Internal SEO links use the exact page topic as anchor text.
