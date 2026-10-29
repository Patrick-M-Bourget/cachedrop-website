# IconButton

A 32px square, icon-only button for dismiss and utility actions (modal close).

**Provide** `icon` and a required `label` (becomes `aria-label`); `onClick` or `href`.

- Use for close (`close`) and secondary utilities only; never for the primary action.
- Colour is `ink-secondary`, turning `ink` on a `surface-subtle` hover.
- On phones, keep at least `tap-min` (44px) of hit area around it.
