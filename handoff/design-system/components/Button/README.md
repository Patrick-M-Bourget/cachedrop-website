# Button

The one way to trigger an action or send someone to download: a pill on marketing pages, a rounded rectangle inside dialogs.

**Provide** `children` (the label), and either `onClick` or `href` (an `href` renders an `<a>`). Optional `icon` / `iconEnd` take an `IconName`.

| Prop | Values | Use |
| --- | --- | --- |
| `variant` | `primary` (default), `secondary`, `quiet`, `danger` | `primary` is the accent fill; `secondary` is white with a `line-strong` border; `quiet` has no chrome; `danger` only for irreversible actions. |
| `size` | `lg` 48px, `md` 40px (default), `sm` ~32px | `lg` for hero and CTA bands, `md` in dialogs, `sm` in the nav. |
| `shape` | `pill` (default), `rounded` | `pill` on pages; `rounded` (radius-md) inside modals and forms. |

**Do**
- Use exactly one `primary` per view: the download, or the form's submit. Repeat the same primary action down a page rather than adding new ones.
- Write labels as verb-first title case from the product: “Download Free Beta”, “Get Your Space Back (Free)”, “Submit Feedback”.
- Pair a large primary with at most one `secondary` beside it (hero: Download + Give Fast Feedback).
- Put the `download` icon only on download buttons.

**Don't**
- Don't use `accent-hover` or custom colours; the component handles hover and the 1px press.
- Don't put a button inside an `<a>`; pass `href` instead.
- Don't use `danger` for anything that moves files to the Trash; CacheDrop's cleanup is reversible and stays `primary`.
