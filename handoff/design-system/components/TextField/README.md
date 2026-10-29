# TextField

A labelled single-line input: 40px, `radius-md`, a `line-strong` edge that becomes the `focus-ring-field` halo on focus.

**Provide** `id` and `label`; `optional` appends “(optional)”; `error` shows a message in `danger-ink` and sets `aria-invalid`. Forwards a ref to the `<input>`.

- Always a visible label above the field; placeholders show an example, never the label.
- Errors say what to do: “Enter a full email address, like you@example.com.”
