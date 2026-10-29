# Modal

A centred 440px dialog over a blurred `overlay` scrim: title, optional subtitle, close button, body and right-aligned footer buttons.

**Provide** `title`, `children`, `footer` (buttons, `shape="rounded"`), `onClose` (scrim click and ✕), optional `subtitle`. `inline` renders in flow for previews and docs; `open={false}` renders nothing.

- Footer: secondary on the left, the one primary on the right.
- `radius-3xl`, `shadow-modal`, 28px padding.
- Trap focus and close on Escape in production; the component leaves that to the host app.
