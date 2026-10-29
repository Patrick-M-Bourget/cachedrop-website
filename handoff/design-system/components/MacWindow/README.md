# MacWindow

A macOS window frame (traffic lights, title bar, optional source-list sidebar) for showing the CacheDrop app on the website.

**Provide** `children` (the main pane), optional `sidebar` groups `[{ label, items: [{ icon, label, active }] }]`, `title`, and `appearance` (`light` / `dark`; sets `data-theme` on the frame so the window can differ from the page).

- Recreate real app screens and real copy (“Storage overview”, “Recommended for review”). Never invent features or numbers for it.
- Max width `window-max` (1040px), `radius-xl`, `shadow-window`. The sidebar hides below 760px.
- Light by default on the website; dark to match the app’s default appearance.
