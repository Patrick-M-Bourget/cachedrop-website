# German glossary

The terms and conventions the German pages at `/de/` use (seo-growth-plan Q17–Q23; once shipped, the website decision that amends Decision 5). Claude drafted the German, and it ships as drafted (Decision 34 precedent, plan Q21); the owner can review it here at any time. Change a term here first, then in every page that uses it. Lines marked *Owner* are choices worth a look.

This file is a mockup: it lives in headquarters-app under `research/marketing/site-drafts/de-DE/` and goes to cachedrop-website as `docs/german-glossary.md` with the de-DE ticket. The Claims Reviewer (`runners/marketing/claims-rules.ts`) enforces the lines marked **(checked)**.

The target is German as written in Germany (de-DE), not Austria or Switzerland.

## Conventions

- **Address the reader as „Sie“.** **(checked)** Same voice as the brand guide: plain, specific, calm. No exclamation marks. Never „du“, „dich“, „dein“.
- **The app is in English (plan Q18).** **(checked)** Every page says so once, in this wording or close to it: „Die App selbst ist derzeit nur auf Englisch verfügbar.“ The homepage's app window shows the app as it ships, in English; only its accessible label is translated.
- **Capitalization.** Nouns are capitalized, as German requires; otherwise headings and buttons are sentence case („Speicherplatz auf dem Mac freigeben“, not „Speicherplatz Auf Dem Mac Freigeben“). Buttons are infinitives („Herunterladen“, „Kaufen“).
- **Punctuation.** No space before `:`, `?`, `!` and `;`. Quotation marks „…“ **(checked)**; the apostrophe is the typographic `’` **(checked)**. A dash is the en dash with spaces ( – ), never the em dash.
- **Compounds with English or brand names take a hyphen** (Durchkopplung): Xcode-Cache, Adobe-Cache, Plug-in-Manager, Mac-Reiniger, node_modules-Ordner, Docker-Images.
- **Units.** `GB`, `MB`, `TB` (not „Go“), with a non-breaking space after the number: „2 GB“, „50 GB und mehr“. **(checked)**
- **Numbers.** Decimal comma, thousands point: „1,5 GB“, „10.000 Dateien“.
- **Prices** show USD until the owner settles € vs $ for `/fr/` (plan Q22): „29,99 $“ with a non-breaking space before the symbol, never „$29.99“. **(checked)** Without a symbol, when the same number applies in every currency: „29,99“.
- **Names stay as their owners write them.** CacheDrop, Mac, macOS, Xcode, DerivedData, node_modules, Docker, Homebrew, npm, Yarn, Premiere Pro, After Effects, Media Encoder, Final Cut Pro, Logic Pro, Ableton Live, Apple Silicon, Intel, Finder, Terminal. Commands, paths and file types are never translated. The plural of Mac is „Macs“.
- **macOS's own German names** for things the reader sees on their Mac: Papierkorb, Systemdaten, Systemeinstellungen, Programme (the Applications folder), Downloads.
- **The app's feature names stay in English** (Smart clean, Clean up, History, Put back, Settings → License), as they read in the app. In prose a German word can follow in brackets the first time: „Put back (Zurücklegen)“.
- **Menu paths in Xcode, Premiere Pro and Final Cut Pro** are given in English, as the menus read in an English install, because the German menu names couldn't be checked against the apps (same choice as the French pages). *Owner: say if you'd rather have the German menu names.*
- **People.** Prefer neutral wording („wer Musik produziert“, „für die Entwicklung“) over job nouns. Where a job noun is unavoidable, the masculine generic („Entwickler“, „Produzenten“), no gender star or colon. *Owner: check; a gender-neutral form is a site-wide choice.*
- **Addresses keep their English slugs** under `/de/` (`/de/clear-adobe-media-cache-mac/`), as Decision 49 does for French (plan Q23). German titles, descriptions and headings carry the German search terms.
- **Search terms from the German query set** (v1) go into titles and headings where they read naturally: „Mac Speicherplatz freigeben“, „Mac aufräumen“, „Mac-Reiniger“, „Cache löschen“ / „Cache leeren“, „App deinstallieren“, „Plug-ins deinstallieren“, „Systemdaten löschen“, „Einmalkauf“. „Mac Cleaner kostenlos“ is searched, but „kostenlos“ never goes in a headline or button (Decision 51).

## Terms

| English | German | Note |
| --- | --- | --- |
| storage cleaner, Mac cleaner | Mac-Reiniger; Speicher-Cleaner | „Mac-Reiniger“ is the main search term (q05). „Mac Cleaner“ as searched, in titles only. |
| free up space | Speicherplatz freigeben | Main search term (q09), with „Mac aufräumen“. |
| clean up (in prose) | aufräumen, bereinigen | The app's „Clean up“ button stays in English. |
| storage, disk space | Speicher, Speicherplatz | |
| Get your Mac's space back. (homepage H1; Decision 51) | Holen Sie sich den Speicherplatz Ihres Macs zurück. | q05 uses „Speicherplatz zurückholen“. *Owner: check.* |
| plug-in (audio) | das Plug-in, die Plug-ins | What German producers write. |
| DAW | DAW (die DAW) | German studios use the English abbreviation. |
| plug-in manager | Plug-in-Manager | q14. |
| app | App | Apple's German pages say „App“; „Programm“ only for the Programme folder. |
| app uninstaller | App-Deinstallationsprogramm; in short „Deinstaller“ | *Owner: check.* |
| uninstall | deinstallieren | „App deinstallieren“, „Plug-ins deinstallieren“. |
| leftovers (app) | Reste | „App-Reste entfernen“ (q21). |
| installer receipt | Installationsbeleg | macOS's receipts in `/var/db/receipts`. *Owner: check.* |
| support files | Support-Dateien | Files an installer adds beside the plug-in. |
| cache, caches | der Cache, die Caches | |
| clear (a cache) | leeren; löschen | Both are searched (q04 „löschen“, q16 „leeren“): use one in the title, the other in the text. |
| delete | löschen | |
| Trash | Papierkorb | macOS's name. |
| System Data | Systemdaten | macOS's name in Storage settings (q17). |
| System Settings › General › Storage | Systemeinstellungen › Allgemein › Speicher | macOS's names. *Owner: check against a German Mac.* |
| ~/Library | Ordner „Library“ | German Finder shows „Library“; paths stay `~/Library/…`. *Owner: check.* |
| Applications folder | Ordner „Programme“ | Finder's German name. |
| Downloads folder | Ordner „Downloads“ | |
| Go › Go to Folder (Finder) | Gehe zu › Gehe zum Ordner … | Finder's German menu. |
| Put back (Finder, the app) | Zurücklegen | Finder's German menu item; the app's label stays „Put back“. |
| Time Machine local snapshot | lokaler Time-Machine-Snapshot | Apple's German support term. *Owner: check.* |
| swap files | Auslagerungsdateien | |
| crash report | Absturzbericht | |
| logs | Protokolle | „Protokolldateien“ where it needs to be clear. |
| Activity Monitor | Aktivitätsanzeige | macOS's name. |
| scan (noun) | Scan | „in einem einzigen Scan“. |
| build files, build output | Build-Dateien | |
| build artifacts | Build-Artefakte | |
| render files | Render-Dateien | q08. |
| media cache (Adobe) | Medien-Cache | q04; the name in Premiere Pro's German settings. *Owner: check.* |
| library (Final Cut Pro) | Mediathek | Final Cut Pro's German name. *Owner: check.* |
| optimized media, proxies | optimierte Medien, Proxys | q20. |
| sample library | Sample-Bibliothek | q22. |
| package cache | Paket-Cache | |
| dangling images (Docker) | verwaiste Images (dangling) | |
| lockfile | Lockfile | Developers say it in English. |
| break (a project) | kaputtmachen | Written as one word: „ohne etwas kaputtzumachen“. |
| safe to delete | bedenkenlos löschbar | q13 „was kann ich bedenkenlos löschen“. |
| developer | Entwickler | See „People“ above. |
| video editing | Videoschnitt | q12. |
| Developer caches and build files (app category) | stays in English | The app's own label. |
| History (the app's view) | Verlauf | In prose; the app's label stays „History“. |
| notarized (by Apple) | von Apple notarisiert | Apple's German developer term. |
| Safe by design | Von Grund auf sicher | Section eyebrow. *Owner: check.* |
| Download for Mac (button; Decision 51) | Für Mac herunterladen | Every button to `/download/`: nav, footer, guides, pricing. |
| Try CacheDrop (inline link) | CacheDrop ausprobieren | |
| Try it before you buy · No card needed · macOS 14 or later | Vor dem Kauf testen · Keine Karte nötig · macOS 14 oder neuer · App auf Englisch | The line under the primary button; its last part is plan Q18's mention on every page that shows it. |
| The app is in English (Q18) | Die App selbst ist derzeit nur auf Englisch verfügbar. | On every German page, once. |
| free to try | kostenlos testen | In body text only, never in a headline or button (Decision 51). |
| Scanning is always free; clean up to 2 GB before you buy | Der Scan ist immer kostenlos. Aufräumen und Deinstallieren sind kostenlos, bis 2 GB freigegeben sind. | The only „kostenlos“ near uninstalling (Decision 48). |
| Pricing (nav link, section) | Preise | |
| Pay once. Use it on 3 Macs. | Einmal zahlen. Auf 3 Macs nutzen. | The pricing section's title. |
| one-time (payment) | einmalig; Einmalkauf | „Einmalkauf“ is searched (q01). |
| subscription | Abo | „Abonnement“ in legal text only. |
| No subscription. Nothing to cancel. | Kein Abo. Nichts zu kündigen. | |
| Every update through version 1, ready for each new macOS when it ships. | Alle Updates für Version 1, bereit für jedes neue macOS, sobald es erscheint. | Decision 51's promise. Never „lebenslange Updates“. *Owner: check.* |
| Buy · $29.99 once (button) | Kaufen · 29,99 $ | With the offer, the regular price is struck through before the offer. |
| Limited-time price (pill) | Zeitlich begrenzter Preis | Decision 47. Never „Einführungspreis“ (launch). |
| Was $29.99, now $19.99 for a limited time (spoken) | Regulär 29,99 $, jetzt 19,99 $ für begrenzte Zeit | What screen readers hear for the struck-through price. |
| the same number in each currency | derselbe Betrag in jeder Währung | |
| What's included | Das ist enthalten | |
| Compare CacheDrop with other Mac cleaners (link) | CacheDrop mit anderen Mac-Reinigern vergleichen | The pricing card's link to the compare page. |
| 30-day refunds, no questions asked | 30 Tage Geld-zurück-Garantie, ohne Angabe von Gründen | |
| A license covers up to 3 Macs | Eine Lizenz gilt für bis zu 3 Macs | |
| license, license key | Lizenz, Lizenzschlüssel | |
| macOS 14 or later | macOS 14 oder neuer | |
| macOS 14 Sonoma or later | macOS 14 Sonoma oder neuer | |
| universal app (Apple Silicon and Intel) | Universal-App für Apple Silicon und Intel | |
| email | E-Mail | |
| Email Me the Link (button; Decision 51) | Link per E-Mail senden | Used only once the download page is translated (plan Q26: later). |
| Check your inbox | Sehen Sie in Ihrem Posteingang nach | Download page, later. |
| spam folder | Spam-Ordner | Apple Mail calls it „Werbung“. *Owner: check.* |
| repository (GitHub) | Repository | |
| privacy policy, terms of sale, refund policy, license agreement | stay English-linked | Plan Q26: the legal pages stay in English for now. Link text in German: „Datenschutz“, „Verkaufsbedingungen“, „Rückerstattung“, „Lizenzvereinbarung“, each marked „(Englisch)“. *Owner: check.* |

## Never in German copy

Each comes from a website decision; the Claims Reviewer blocks it.

- „Beta“ (Decision 51).
- „Datenmüll“, „Müll“, „Junk-Dateien“, „unnötige Dateien“ (Decision 51: no „junk“).
- „neu erstellbar“, „neu aufbaubar“ (Decision 48: no „rebuildable“).
- „ungenutzte“ or „doppelte“ Plug-ins (Decision 48).
- „Einführungspreis“, „Launch-Preis“, „Rabatt“ for the offer (Decision 47).
- „kostenlos“ or „gratis“ for uninstalling, and in any headline or button (Decisions 48, 51).
- „lebenslange Updates“, „Updates auf Lebenszeit“ (Decision 51).
- Invented proof: „Testsieger“, „Nr. 1“, „von Apple empfohlen“, user or download counts, star ratings (Decision 51).
- „aufgebläht“ in a sentence with a competitor's name (Decision 54).
