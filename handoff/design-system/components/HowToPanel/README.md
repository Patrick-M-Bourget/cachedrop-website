# HowToPanel

Side-by-side panels comparing the manual way with the CacheDrop way on guide pages.

**Provide** `title`, `children` (an ordered list of steps, or a paragraph), optional `note` (a caveat under a hairline) and `link`.

- Always in pairs inside a `.cd-grid`: `variant="outline"` for the manual way (left), `variant="fill"` for the CacheDrop way (right).
- Manual steps are real, current menu paths; give older names in parentheses.
- The note states the limitation honestly (“only deletes caches for the open version”).
