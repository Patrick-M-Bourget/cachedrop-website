# Logos

All four files come straight from the app repo (`mac-cleaner`, `CacheDrop/App`). Copy them; never redraw or re-tint the mark.

- `cachedrop-mark.svg`: the brand mark, a drop with a check cut out of it (even-odd fill), single ink `#000000`. It is the app's `BrandMark` template image, shown beside the name in the app sidebar and in the menu bar. On the web set it in `ink`: inline the path with `fill="currentColor"`, or use `CacheDrop.Logo`.
- `cachedrop-mark-white.svg`: the same mark in `#FFFFFF` for dark grounds.
- `cachedrop-app-icon-light.svg`: the macOS app icon (squircle platter, graphite drop, white check). Source of truth for the AppIcon set. Use it where the app itself is shown: download page, App Store–style badges, social cards.
- `cachedrop-app-icon-dark.svg`: the dark-appearance app icon (dark platter, white drop, graphite check).

Lockup: mark, then the name “CacheDrop” set live in type with an 8px gap (`space-2`). The app sets the mark at 24pt with the name at 17pt medium; the website nav uses an 18px-tall mark (13×18) with `title-sm`. Keep the mark's 372:510 proportion; never squeeze it into a square. There is no wordmark file: always set the name in type.
