# FeatureCard

A white card for one audience or capability: icon tile, H3 title, one-sentence body, path chips, and an optional link to the guide.

**Provide** `title`, `children` (the body sentence), `icon`, up to 3 `chips`, and `link` `{ href, label }`. `id` lets the nav jump to it.

- Lay cards in a `.cd-grid` (auto-fit, min 300px, 24px gap) on a `surface-subtle` band.
- Three cards per row at most; all cards in a row carry the same parts so their edges line up.
- Body copy is one sentence naming concrete things (folders, apps), never adjectives alone.
