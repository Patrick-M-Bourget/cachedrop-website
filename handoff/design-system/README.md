CacheDrop is a native Mac storage cleaner for developers and video editors, in public beta. Its website and app are calm, precise and Apple-native: white space, graphite type, one blue, hairlines instead of boxes. Everything here exists so a page or screen built by any agent looks like it came from the same hand.

## Start here

1. Load `tokens.css`, then `components/bundle.css` (it imports Inter and JetBrains Mono from Google Fonts), then React 18 and `components/bundle.js`. Components are on `window.CacheDrop`.
2. Wrap the page in `class="cd-root"` and set `body` to `surface` / `ink`. Add `data-theme="dark"` on any element to switch that subtree to the dark theme.
3. Build pages from the components first (NavBar, SectionHeader, FeatureCard, FAQList, Footer…). Reach for raw tokens only for layout between them.
4. Never write a literal colour, size or radius. Every value has a token; if one is missing, add the token here first.

## Content fundamentals

**Voice.** Plain, specific and calm, like a careful senior engineer explaining what is safe to delete. The product's promise is safety, so the copy never hypes, never scares, and never claims what it can't prove.

- Name real things: folders, apps, file types, commands. “Drop gigabytes of forgotten `node_modules`, Xcode DerivedData, and Docker caches safely.” not “Supercharge your Mac.”
- Short sentences. One idea each. No exclamation marks, no emoji (the feedback rating scale is the single exception), no “unleash / supercharge / blazing”.
- Address the reader as “you” and “your Mac”; the product is “CacheDrop” (never “we” as the subject of a feature; “we” only for the team asking for feedback).
- Never invent numbers, benchmarks or testimonials. Sizes in the app are estimates: “About 3.7 GB”. Marketing figures come only from the brief (“500MB+”, “100GB+”, “50GB”).
- Reassure with mechanism, not adjectives: “Cleaned items go to the Trash, so changing your mind is one drag away.”

**Casing.**
- Page and section headlines: sentence case, ending with a period on marketing pages (“Store less junk. Keep what matters.”, “Built for the heavy lifters.”). Guide H2s are plain sentences or questions without a period.
- Feature card titles and button labels: Title Case (“Clear Developer Junk”, “Download Free Beta”, “Submit Feedback”).
- Eyebrows and the BETA tag: written in sentence case in source, uppercased by style.
- Product and platform names exactly as their owners write them: macOS, Xcode, DerivedData, node_modules, Final Cut Pro, Premiere Pro, Apple Silicon.

**Real examples to copy the tone of:**
- Hero: “Your Mac is full of invisible caches, derived data, and abandoned project files. CacheDrop safely finds them and drops them.”
- Micro-copy: “Free for a limited time · Help us build it”
- Safety: “Every recommendation shows its size and the files inside before anything moves.”
- App: “Package caches and build files that tools rebuild” · “Installers and large files you haven’t opened lately”
- Confirmation: “Thanks, that helps. We read every note and use them to decide what to build next.”

**Search and answer-engine writing (SEO / GEO).** Every public page targets one search intent.
- One H1 per page; strict H1 → H2 → H3. The hero sub-headline is an H2.
- Put the page's primary keyword in the H1 or the hero H2, the status pill or first lede, and the title tag. Homepage: “Mac storage cleaner”, “free up space on Mac”, “clear Mac disk”.
- Define the product in one quotable sentence near the top: “CacheDrop is a Mac storage cleaner made for developers and video editors.”
- Guides: a “How to …” table of contents, real commands in `CodeBlock`s, the manual way beside the CacheDrop way (`HowToPanel`), an “Updated <Month Year>” line, and a `FAQList` whose answers start with a direct answer.
- Link guides from the nav, feature cards and footer with exact-match anchors (“Clear Developer Caches”, “Clear Adobe Media Cache”).
- Ship JSON-LD for SoftwareApplication (home), Article + BreadcrumbList (guides) and FAQPage (any page with a FAQList).

## Visual foundations

**Colour.** A neutral, Apple-graphite system with a single blue.
- Grounds: `surface` (page), `surface-subtle` (alternating bands, tiles, code), `surface-elevated` (guide hero band, table heads), `surface-raised` (cards, modals). Alternate `surface` and `surface-subtle` bands down a page; never stack two `surface-subtle` bands.
- Text: `ink` for headings, `ink-body` for long prose, `ink-soft` for card and FAQ bodies, `ink-secondary` for ledes, captions, nav links and metadata. `ink-tertiary` is for placeholders only (it fails 4.5:1).
- Blue: `accent` fills the one primary button, selected states and progress; labels on it are `on-accent`. Text links use `accent-text`, never `accent` (which drops to 4.3:1 on `surface-subtle`).
- Status: dots use `success` / `danger`; any status text uses `success-ink` / `danger-ink` on `success-soft` / `danger-soft`. Status is always spelled out in words.
- App category tints `cat-dev` and `cat-downloads` (with their `-soft` tiles) appear only inside the product mock.
- Dark theme: derived from the app's own dark window. Accent lightens to `#4D97FF` and its labels turn dark (`on-accent`), so always use the token, never literal white.

**Type.** Inter for everything, JetBrains Mono for anything a person could type.
- Display (`display-xl` 76, `display-lg` 64, `display-md` 52, `display-sm` 56): weight 600, tracking −0.035 to −0.04em, `text-wrap: balance`; scale them with `clamp()` down to the mobile sizes in each style's usage.
- Headings: `headline-lg` 40 (homepage sections), `headline-md` 34 (guide sections), `headline-sm` 24 (numbered guide H3), `title-lg` 20, `title-md` 18 (cards, FAQ questions).
- Body: `body-lede` 19/29 for hero sub-headlines, `body-article` 17/28 for guides, `body-md` 15/23 for cards, `body-sm` 13 for micro-copy. Keep prose at `reading-max` (760px) and ledes at `lede-max` (620px).
- `eyebrow` (12px, 600, 0.06em, uppercase, `ink-secondary`) sits above section H2s. Use it once per section, never as a decoration on cards.
- Mono: `code-md` 13 for blocks and step numbers, `code-sm` 12 for chips, `code-inline` 0.86em in prose.

**Spacing and layout.**
- 4px base, 8px rhythm (`space-1` … `space-32`). Lay out siblings with flex/grid `gap`, not margins.
- Containers: `container-max` 1120px with `space-6` side padding (min `space-4` on phones); guides use a `reading-max` 760px column.
- Section bands: `space-30` (120px) vertical padding; the hero opens with `space-28` and closes with `space-32`.
- Grids: `repeat(auto-fit, minmax(min(300px, 100%), 1fr))` with `space-6` gaps, so cards stack on phones without breakpoints.
- Below `breakpoint-md` (760px) the nav links and the app sidebar hide; nothing else needs a media query.
- Centre only the hero and closing CTA band. Everything else aligns left.

**Shape, borders and elevation.**
- Hairlines first: `line` 1px rules separate FAQ items, steps, footer and card sections.
- Radii: `radius-xs` chips, `radius-md` inputs and dialog buttons, `radius-lg` code blocks and tiles, `radius-2xl` cards and panels, `radius-3xl` modals, `radius-full` marketing buttons and pills.
- Shadows are nearly invisible: `shadow-card` on cards (always with a `line` border), `shadow-window` only on the product shot, `shadow-modal` only on dialogs, `shadow-button` bevel only on accent buttons.
- The nav is frosted: `glass` + `backdrop-nav` + `glass-line`. Modals sit on `overlay` + `backdrop-modal`.
- No gradients, glows, coloured left borders or decorative blobs.

**Motion.** Quiet and quick. Colour and background transitions 150ms ease; buttons press down 1px on `:active`; the Copy button confirms for 1.6s. No entrance animations, parallax or looping motion. Respect `prefers-reduced-motion` (bundle.css already does).

**States.**
- Hover: buttons brighten (`accent-hover`) or fill `surface-subtle`; links underline.
- Focus: every control shows `focus-ring` (2px surface gap + 2px solid accent) on `:focus-visible`; text inputs use `focus-ring-field`.
- Selected: `accent-soft` fill with `shadow-selected` ring (rating buttons), or `window-selected` (sidebar rows).
- Disabled: 45% opacity, no pointer events. Errors: `danger-ink` text under the field, `aria-invalid` on it.

**Imagery.** The product is the picture. Show the real app in a `MacWindow`, with real copy and plausible figures from the app. No stock photos, people, illustrations or 3D renders. No photos of Apple hardware.

**Accessibility.** Text meets 4.5:1 on the grounds named in each token's usage, in both themes. Known source exceptions are flagged: `ink-tertiary` (placeholders only), `line-strong` (control borders below 3:1, always paired with a label and focus ring) and `accent-hover` (a momentary hover). Touch targets are at least `tap-min` (44px). Use real `<button>`, `<a href>`, `<label>`; every icon-only button has a label.

## Iconography

- One stroke icon set, drawn for CacheDrop on a 24px grid with round caps and joins: `Icon` in the bundle (`currentColor`) or the SVGs in the Icons asset group (single ink `#1D1D1F`).
- Stroke 1.8 at 14–18px, 1.6 at 20px and up. Sizes: `icon-xs` 12, `icon-sm` 14, `icon-md` 18, `icon-lg` 22.
- Meanings are fixed: `terminal` = developers, `film` = creators, `drive` = disk / system, `download` = download only, `sparkle` = Smart clean, `shield` = safety, `trash` = moves to Trash.
- Icons sit in an `IconTile` on cards, or inline before a label in buttons and app rows. Never alone as decoration, never emoji.
- The brand mark is the drop with a check cut out of it, copied from the app (`BrandMark`). Use the files in Logos or `CacheDrop.Logo`; never redraw it, outline it or put it in a coloured circle. The full-colour app icon is for showing the app itself, not for the nav.

## Page recipes

**Homepage.** NavBar → hero (StatusPill, `display-xl` H1, `body-lede` H2, Button lg primary + secondary, micro-copy, MacWindow) → `surface-subtle` band with SectionHeader + three FeatureCards → two-column “Careful by default” (SectionHeader + StepList rows) → FAQList section → `surface-subtle` closing CTA (SectionHeader xl centred + primary Button) → Footer.

**Guide page.** NavBar (active) → `surface-elevated` hero band (Breadcrumb, `display-lg` H1, `body-lede` H2, Button + platform line, “Updated” line) → 760px column: TableOfContents, sections of `body-article` prose with CodeBlocks, HowToPanels or a DataTable, FAQList (`article`), Callout to the other guide → CTA band → Footer.

**Utility page (download, confirmation).** NavBar → centred IconTile lg, `display-sm` H1, lede, meta line, retry ArrowLink → StepList cards → feedback panel → links to both guides → Footer. Mark it `noindex`.
