# CacheDrop website — design handoff

Exported 29 October 2026. Everything needed to build and ship cachedrop.app: four production-ready static pages, the design system they are built from, and reference screenshots.

```
cachedrop-handoff/
├── HANDOFF.md                 ← you are here
├── site/                      ← deployable static site (no build step)
├── design-system/             ← tokens, components, icons, logos, brand guide
├── screenshots/               ← desktop (1440) and mobile (390) renders of every page
└── source/                    ← the original design-canvas files, for reference
```

## 1. Run it locally

```sh
cd site && python3 -m http.server 8000      # or: npx serve site
open http://localhost:8000
```

Links are root-relative (`/download/`), so open the site through a server, not by double-clicking the files. The component gallery works the same way: serve `design-system/` and open `index.html`.

## 2. Pages

| URL | File | Purpose | Indexed |
| --- | --- | --- | --- |
| `/` | `site/index.html` | Homepage, broad intent | yes |
| `/clear-mac-developer-caches/` | `site/clear-mac-developer-caches/index.html` | Developer SEO guide | yes |
| `/clear-adobe-media-cache-mac/` | `site/clear-adobe-media-cache-mac/index.html` | Creator SEO guide | yes |
| `/download/` | `site/download/index.html` | Landing for every Download button; starts the .dmg | `noindex, follow` |
| feedback modal | in every page (`#feedback`) | Opens from “Provide Feedback” / “Give Fast Feedback” | — |

Each page is plain HTML with its CSS inline, plus three shared files in `site/assets/`: `fonts/fonts.css` (self-hosted Inter and JetBrains Mono, OFL-licensed), `site.js` (modal, copy buttons, download start) and the icons. There is no framework and nothing to compile. Port to Astro or Next.js by moving each page's markup into a layout; keep the head tags exactly as they are.

## 3. Before launch: fill these in

Search the site for `[` placeholders:

| Placeholder | Where | What |
| --- | --- | --- |
| `[FEEDBACK_WEBHOOK_URL]` | `site/assets/site.js` (or set `window.CACHEDROP_FEEDBACK_ENDPOINT`) | The secure webhook that creates a structured issue in the private repo. |
| `[DMG_URL]` | `site/assets/site.js` and the retry link on `/download/` | The signed, notarized .dmg. The download page starts it 0.4 s after load. |

Feedback POSTs JSON: `{ rating, email, message, page, specs }`. `rating` is `angry | meh | neutral | happy | love | null`; `specs` is `{ userAgent, platform, language }` only when the checkbox is on, otherwise `null`. Validate and rate-limit on the server; never echo a repository or GitHub name back to the user.

## 4. SEO and answer engines (GEO)

Built in already, per page: `<title>`, meta description, canonical, Open Graph and Twitter tags, favicon and touch icon, JSON-LD, one H1 with a strict H1 → H2 → H3 outline, and visible FAQ text that matches the structured data. Also `robots.txt` and `sitemap.xml` (the download page is left out of the sitemap and marked `noindex`).

| Page | Title tag | Primary keywords | JSON-LD |
| --- | --- | --- | --- |
| `/` | Mac Storage Cleaner – Free Up Space on Your Mac \| CacheDrop | Mac storage cleaner, free up space on Mac, clear Mac disk | Organization, SoftwareApplication (free offer, macOS 14+), FAQPage (6) |
| Developer guide | Clear Xcode DerivedData, node_modules & Docker Cache on Mac | delete Xcode DerivedData, clear node_modules Mac, clear Docker cache Mac, developer mac cleaner | Article (dateModified), BreadcrumbList, FAQPage (5) |
| Creator guide | Clear Adobe Media Cache on Mac (Premiere Pro & Final Cut Pro) | clear Adobe media cache Mac, Final Cut Pro render files taking up space, Premiere Pro cache clear | Article (dateModified), BreadcrumbList, FAQPage (5) |

Keep these rules when editing copy:
- Every FAQ answer starts with the direct answer (“Yes.”, “No.”, a definition). Answer engines quote that first sentence.
- When a guide's commands or menu paths change, update the visible “Updated October 2026” line and `dateModified` together, and add the new `lastmod` to `sitemap.xml`.
- The footer's “Cleaning Guides” anchors are exact-match on purpose. Don't rename them.
- Google only shows FAQ rich results for government and health sites, so the FAQPage markup won't add dropdowns to search results. It is still worth keeping: other search and AI answer engines read it.

## 5. Design system

`design-system/README.md` is the brand guide and the rulebook. Read it first. It covers voice, colour, type, spacing, iconography, accessibility and page recipes. Then:

- `tokens.json`: source of truth (38 colours in light and dark, 24 text styles, 22 spacing steps, sizes, 8 radii, 7 shadows, effects, z-index).
- `tokens.css`: the same tokens as CSS custom properties, plus a class per text style (`.display-xl`, `.body-md`…). Dark theme: `data-theme="dark"` on any element.
- `components/bundle.js` + `bundle.css` + `index.d.ts`: 31 React 18 components on `window.CacheDrop` (Button, NavBar, FeatureCard, FAQList, CodeBlock, FeedbackForm, MacWindow…). Each has `components/<Name>/README.md` with props and do's and don'ts.
- `index.html`: live gallery of every component, with a dark-theme toggle.
- `assets/Logos/`: the real mark and app icons, copied from the app repo (`mac-cleaner/CacheDrop/App`). `assets/Icons/`: 19 stroke icons.
- `fonts/`: Inter and JetBrains Mono woff2 files and their licences.

The static pages use literal values that match these tokens. If you port the site to components, swap them for `var(--token)` and the bundle components.

**Colour rules that are easy to miss:** text links use `accent-text` `#0066CC`, never the button blue `#0071E3`; success and error text use the `-ink` tokens, not the bright system green and red. `ink-tertiary` `#86868B` and `line-strong` `#D2D2D7` are kept from the original DESIGN.md but fall below contrast targets, so use them only as their token notes say.

## 6. Open items for the team

1. **App window on the homepage.** It shows the early “Storage overview” screen from the first draft (Smart clean, Storage trends). The current app prototype (`mac-cleaner/docs/visual/preview.html`) has Overview, Cleanup plan and History. Re-shoot or rebuild the window from the shipping app before launch.
2. **Claims to confirm with engineering:**
   - Cleaned items go to the Trash (the prototype says so; keep it true).
   - The Developer guide's H1 promises “Reclaim 50GB of forgotten code” (from the brief).
   - The “With CacheDrop” lines on the guides describe the app scanning chosen folders and listing node_modules, Docker, Homebrew, npm and Dart caches, Adobe caches for every installed version, and Final Cut Pro render files per library.
   - The download page assumes a drag-to-Applications .dmg and folder access under Locations & access.
3. **Premiere menu path.** The guide says “Settings › Media Cache (Preferences › Media Cache in older versions)”. Recheck against the current Premiere release at launch.
4. **Production URL and Open Graph image.** Canonicals assume `https://cachedrop.app`. `assets/og-image.png` is a simple generated card; replace it with a designed one if you have one.
5. **Analytics and consent.** None are included. If you add analytics, add a consent banner first (Quebec Law 25 / GDPR).

## 7. Accessibility checklist (already met in the pages)

- Text contrast is at least 4.5:1 everywhere except the documented exceptions above.
- Real `<a>` and `<button>` elements, visible focus rings and a labelled close button. The modal traps focus and closes on Escape and on backdrop click.
- Decorative SVGs are `aria-hidden`. The product shot is a `<figure>` with a label.
- Layouts reflow to one column with no horizontal scrolling at 390 px. Wide tables scroll inside their own box.
