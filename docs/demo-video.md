# Demo video: seed, storyboard and captions (#48)

Everything needed before the shoot: a ~40 s cut for the site and two 15 s Meta ads (music producers, developers). CacheDrop is filmed on current `main` in a staged macOS account named **demo**, filled by `scripts/demo/seed.sh`. Screen names follow mac-cleaner's `GLOSSARY.md`; behaviour was checked against mac-cleaner `main` at `ca7d1ab` (2026-11-01). File and line references below are to that commit.

## Before the shoot (owner)

1. **Create the account.** System Settings › Users & Groups › Add User: a **Standard** account with the short name `demo`. Creating it needs an admin password; nothing after that does. Log in to it once so macOS creates its home.
2. **Apps the seed relies on.** These must be installed in `/Applications`, as they are on the owner's Mac: Ableton Live, Native Access, UA Connect and LANDR. App caches only offers a `~/Library/Caches/<bundle ID>` folder whose app is installed (`AppCaches.swift:33`, `:192`, and `Catalog.swift:575` drops an item whose owner is unknown). If a row is missing in the demo account, open Finder › Applications once so Launch Services registers the apps for that user. Keep every one of these apps closed while filming: CacheDrop skips an app's items while it runs.
3. **Install CacheDrop** from current `main` for the demo account. In the demo account, allow CacheDrop's Downloads prompt; Full Disk Access isn't needed for anything the seed writes.
4. **Seed**, logged in as demo, from a copy of this repo:

   ```sh
   scripts/demo/seed.sh --dry-run   # plan, total and the free-space verdict
   scripts/demo/seed.sh             # about 12 GB, a few minutes
   scripts/demo/seed.sh reset       # between takes: removes exactly what it wrote, then writes it again
   scripts/demo/seed.sh remove      # after the shoot
   ```

   The script refuses to run unless the current user and the home's owner are both `demo`, refuses when less than seed + 5 GB is free, and refuses to overwrite anything it didn't write. It keeps a manifest in `~/.cachedrop-demo-seed/`. `reset` deletes only the files in that manifest, the folders it created (when empty) and the items CacheDrop moved to `~/.Trash` that still carry the seed's `io.cachedrop.demo-seed` mark. Sizes: `MUSIC_GB` (4.5), `DEV_GB` (6), `LEFTOVERS_GB` (0.5), `DOWNLOADS_GB` (1), `SIZE_SCALE` (1); `INCLUDE_HOMEBREW=0` drops the Homebrew cache (see below).
5. **Between takes**, don't untick anything in Smart clean: an untick survives rescans (RESET Decision 67). Run `reset`, then **Scan again**.

## What the seed writes and why CacheDrop recommends it

Every byte is written from `/dev/urandom` and checked to be fully allocated: no sparse files, no `mkfile -n`, no APFS clones. Results measure free space before and after each item (SPEC section 6), so a clone would show almost nothing freed.

Smart clean takes items whose kind rebuilds itself (`.cache`, `.build`, …) and that the user doesn't choose one by one (`RecommendedPlan.swift:33`, `:46-51`), downloads untouched for 7 days (`:37`, `:53`) and files from deleted apps tied by bundle ID or receipt (`:55`).

| Group | Path under the demo home | Size | Rule (screen name) | Evidence |
|---|---|---|---|---|
| Music | `Library/Caches/Ableton/Cache/Decoding/*.wav` | 2.7 GB | `ableton-cache`, Ableton Live cache (App caches) | `AppDataCaches.swift:110-115` |
| Music | `Library/Caches/com.ableton.live`, `com.native-instruments.nativeaccess2`, `com.uaudio.ua-connect`, `com.landr.app` (`fsCachedData/`) | 1.8 GB | `app-caches`, App caches | `AppCaches.swift:186-194`; the app must be installed |
| Dev | `Library/Developer/Xcode/DerivedData/BeatGrid-<28 letters>`, `SampleBrowser-<28 letters>` | 3.0 GB | `xcode-derived-data`, Xcode DerivedData | `Catalog.swift:277-287` (name rule #545) |
| Dev | `Library/Developer/Xcode/iOS DeviceSupport/iPhone17,1 18.5 …`, `18.6 …` (plus 26.0 and 26.1 at 1 MB, which Xcode keeps) | 1.2 GB | `xcode-device-support`, Old device support files | `Catalog.swift:288-293` (2 newest kept) |
| Dev | `.npm/_cacache/content-v2/…` | 1.1 GB | `npm-cache`, npm cache | `Catalog.swift:210-217` |
| Dev | `Library/Caches/Homebrew/downloads`, `api` | 0.7 GB | `homebrew`, Homebrew cache (runs `brew cleanup -s`, then deletes the folder) | `Catalog.swift:268-276` |
| Deleted app | `Library/Application Support/com.driftwave.LoopSmith/`, `Library/Preferences/com.driftwave.LoopSmith.plist`, `Library/Saved Application State/com.driftwave.LoopSmith.savedState` | 0.5 GB | `removed-app-leftovers`, Files from deleted apps (group "LoopSmith") | `RemovedAppLeftovers.swift:22`, `:75`, `:85-87`, `:121-127` |
| Downloads | `Downloads/LoopSmith-2.4.1.dmg` (21 days old), `TapeEcho-3.0-Installer.dmg` (45), `SampleBrowser-Beta-0.9.dmg` (9) | 1.0 GB | `downloads`, Downloads; Old downloads in Smart clean | `Catalog.swift:302-306`, `:706-712` |

**The deleted app needs no installer receipt.** A bundle-ID item is confirmed when a container or a saved window state proves the ID was an app's (`RemovedAppLeftovers.swift:73-77`, checked again before acting at `:155`), so the seed writes a `.savedState` folder. `com.driftwave.LoopSmith` is fictional: no app, Spotlight entry or maker named `driftwave` is installed, which the scan requires (`:54`). This mirrors the UI test fixture in `CacheDrop/UITests/ApplicationsUITests.swift:47` (a `Library/Containers/<id>` folder), using saved state instead so macOS doesn't ask about other apps' data. `PREPARE_SYNTH_APP` builds an *installed* app for the quit journey, so it doesn't apply here.

**Downloads age.** Smart clean reads the latest of modification, creation and Spotlight's last-opened date, never access time (`Catalog.swift:706-712`). `touch -t` with a date older than the file's creation date moves the creation date back too on APFS, so the DMGs count as 9 to 45 days old.

**Not seeded:**
- *Simulator caches.* Simulators are changed only through `simctl` (Decision 21), are chosen one by one and are never recommended (`DeveloperDevices.swift:12-27`, `Catalog.swift:294-299`). A fake device folder wouldn't be listed by `simctl`. Old device support files stand in for "simulator and device data".
- *Sample-library caches* beyond Live's decoding cache. Kontakt and other Native Instruments libraries, Splice samples, Ableton Packs and the Logic library are guidance only or not listed (SPEC section 3, "Guidance only", and the Ableton note). Live's decoding cache is the sample cache CacheDrop cleans.

**Expected figures** (at scale 1): about 10.5 GB is deleted permanently. That is Overview's "Recommended for review · Up to …", Smart clean's **Ready to clean**, and roughly Results' **Measured freed space**. About 1.5 GB goes to the Trash: Results show it as "In the Trash · Freed when you empty it", never as freed (`CatalogResultsSection.swift:32`, `:36`). Allocation rounding and other activity move the measured figure a little; the rehearsal confirms it.

## Storyboard: site cut (~40 s)

No Welcome screen in any cut. Start on Overview after a scan has finished.

| # | Time | Screen | Action |
|---|---|---|---|
| 1 | 0:00–0:05 | Overview | Hold on "Recommended for review · Up to {N} GB" and the category rows |
| 2 | 0:05–0:11 | Smart clean | Click **Smart clean ›**; the page lists categories with **Ready to clean** |
| 3 | 0:11–0:18 | Review sheet | Click **Clean up**; the sheet runs its checks, then groups items under **Delete permanently** and **Move to Trash** |
| 4 | 0:18–0:22 | Cleaning | Click **Clean up** in the sheet; progress |
| 5 | 0:22–0:29 | Results | Hold on **Measured freed space** {M} GB, then the "In the Trash" line |
| 6 | 0:29–0:35 | Applications | **Files from deleted apps**: the LoopSmith group, ticked, with its size |
| 7 | 0:35–0:40 | End card | "Free to try · Apple Silicon & Intel Macs, macOS 14+" · cachedrop.io |

Scene 6 must come from a take filmed **before** cleaning: Smart clean includes files from deleted apps (Decision 67), so after scene 5 the LoopSmith group is gone. Film it right after a `reset` and scan, and cut it in.

## Storyboard: Meta cuts (15 s)

| # | Time | Producers | Developers |
|---|---|---|---|
| 1 | 0:00–0:03 | Hook: Overview total | Hook: Overview total |
| 2 | 0:03–0:06 | Smart clean, **App caches** opened: Ableton Live cache, Live, Native Access, UA Connect, LANDR | Smart clean, **Developer caches and build files** opened: Xcode DerivedData, Old device support files, npm cache, Homebrew cache |
| 3 | 0:06–0:10 | Review sheet | Review sheet |
| 4 | 0:10–0:13 | Results: Measured freed space | Results: Measured freed space |
| 5 | 0:13–0:15 | End card | End card |

The timings are a plan; the rehearsal take on `main` sets them (the Review sheet's checks take a moment before **Clean up** is available, Decision 126).

## Captions

`{N}` is Overview's figure and `{M}` Results' measured figure, both read from the filmed take. App labels stay in English in the French captions, since the app ships in English (french-glossary.md).

### Site cut

| # | English | French |
|---|---|---|
| 1 | Up to {N} GB of caches and build files on this Mac. | Jusqu’à {N} Go de caches et de fichiers de compilation sur ce Mac. |
| 2 | Smart clean picks what rebuilds itself. Untick anything you want to keep. | Smart clean choisit ce qui se reconstruit. Décochez ce que vous voulez garder. |
| 3 | See exactly what happens to each item before anything changes. | Voyez exactement ce qui arrive à chaque élément avant tout changement. |
| 3b | Caches and build files are deleted. Your files go to the Trash. | Les caches et les fichiers de compilation sont supprimés. Vos fichiers vont à la Corbeille. |
| 4 | Each item is checked again right before CacheDrop acts on it. | Chaque élément est vérifié de nouveau juste avant que CacheDrop agisse. |
| 5 | {M} GB freed, measured on the disk, not estimated. | {M} Go libérés, mesurés sur le disque, pas estimés. |
| 6 | Files from deleted apps, tied to each app by its bundle ID, go to the Trash. | Les fichiers d’applications supprimées, liés à chaque application par son identifiant, vont à la Corbeille. |
| 7 | Free to try · Apple Silicon & Intel Macs, macOS 14+ · cachedrop.io | Essai gratuit · Mac Apple Silicon et Intel, macOS 14+ · cachedrop.io |

### Producers (15 s)

| # | English | French |
|---|---|---|
| 1 | Up to {N} GB of caches on this Mac. | Jusqu’à {N} Go de caches sur ce Mac. |
| 2 | Ableton Live’s decoded samples and your music apps’ caches. Your Sets, samples and Packs are kept. | Les échantillons décodés d’Ableton Live et les caches de vos applications de musique. Vos Sets, échantillons et Packs sont conservés. |
| 3 | See exactly what happens before anything changes. | Voyez exactement ce qui arrive avant tout changement. |
| 4 | {M} GB freed, measured. | {M} Go libérés, mesurés. |
| 5 | Free to try · Apple Silicon & Intel Macs, macOS 14+ · cachedrop.io | Essai gratuit · Mac Apple Silicon et Intel, macOS 14+ · cachedrop.io |

### Developers (15 s)

| # | English | French |
|---|---|---|
| 1 | Up to {N} GB of caches and build files on this Mac. | Jusqu’à {N} Go de caches et de fichiers de compilation sur ce Mac. |
| 2 | Xcode DerivedData, npm and Homebrew caches. Archives and your projects are kept. | DerivedData de Xcode, caches npm et Homebrew. Les archives et vos projets sont conservés. |
| 3 | See exactly what happens before anything changes. | Voyez exactement ce qui arrive avant tout changement. |
| 4 | {M} GB freed, measured. | {M} Go libérés, mesurés. |
| 5 | Free to try · Apple Silicon & Intel Macs, macOS 14+ · cachedrop.io | Essai gratuit · Mac Apple Silicon et Intel, macOS 14+ · cachedrop.io |

Wording rules followed: no "speed up your Mac", no "you have X GB" (the figure is "on this Mac"), no fear claims, and no "everything goes to the Trash" (Decision 23).

## Caption claims checked

| Claim | Source |
|---|---|
| "Up to {N} GB": Overview's total is an upper bound of items that free space; Trash-bound items aren't counted | `CacheDropApp.swift:439-445`, `:533-536`; SPEC section 6 |
| Smart clean takes what rebuilds itself; untick to keep | `RecommendedPlan.swift:33`, `:46-56`; page subtitle `SmartCleanView.swift:54` |
| The Review sheet shows what happens to each item, grouped by consequence, before acting | GLOSSARY (Review sheet); SPEC sections 4 and 5 ("The review sheet is the preview") |
| Caches and build files are deleted; your files go to the Trash | mac-cleaner RESET Decision 3; SPEC section 2; site Decision 23. Downloads and files from deleted apps go to the Trash (`Catalog.swift:305`, `RemovedAppLeftovers.swift:13`, RESET Decision 41) |
| Each item is checked again right before acting | SPEC section 4 |
| Measured, not estimated | SPEC section 6; "Measured freed space" `CatalogResultsSection.swift:32` |
| Tied by bundle ID; goes to the Trash | `RemovedAppLeftovers.swift:4-6`; RESET Decision 41 |
| Ableton: Sets, samples and Packs are kept | `AppDataCaches.swift:110-115` (the rule's own consequence text) |
| Xcode: archives and projects are kept | `Catalog.swift:277-280` (the rule's own consequence text) |
| Apple Silicon & Intel, macOS 14+ | site Decision 46 (universal Release `arm64 x86_64`, `MACOSX_DEPLOYMENT_TARGET = 14.0`; mac-cleaner Decisions 144 and 148) |

**Not verified, owner to decide:**
- **"Free to try"** (owner, 2026-11-01): generic on purpose, so the cuts stay true through the beta, trials and tiered features later. Don't change it to "Free" or "Free beta".
- **Homebrew in another account.** `/opt/homebrew` belongs to the owner's account; `brew cleanup -s` run as demo may fail on files it can't write, and Results would show the Homebrew item as failed (`CleanupExecutor.swift:307-311`). Check in the rehearsal; if it fails, re-seed with `INCLUDE_HOMEBREW=0` and drop "Homebrew" from the developer caption 2.
- **The figures.** {N} and {M}, and whether measured and estimated land close together, need the real 12 GB run in the demo account.
- **Scene timings** need the rehearsal take.
