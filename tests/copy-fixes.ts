// The agreed copy changes against the handoff (Decision 23: claims match the app).
// The head diff and the same-browser screenshot compare the build with the handoff
// original after these replacements, so every other byte of copy still has to match.
// Each `from` is replaced everywhere in its page, which keeps visible FAQ text and the
// FAQPage JSON-LD in step. Checked against mac-cleaner main at 5bf77c7 on 2026-10-29.
export type CopyFix = { from: string; to: string; why: string };

export const copyFixes: Record<string, CopyFix[]> = {
  'index.html': [
    {
      from: 'node_modules and render files, and clears them safely',
      to: 'node_modules and video caches, and clears them safely',
      why: 'The app never removes Final Cut render files; it clears the Adobe media cache (GuidanceCatalog.swift, AppDataCaches.swift).',
    },
    {
      from: 'old node_modules folders and video render files',
      to: 'old node_modules folders and video editing caches',
      why: 'As above: Final Cut libraries get guidance only.',
    },
    {
      from: 'compiler caches, render files and stale container images',
      to: 'compiler caches, media caches and stale container images',
      why: 'As above.',
    },
    {
      from: 'Strip out massive Final Cut Pro render files and hidden Adobe media caches without losing your project timelines.',
      to: 'Clear hidden Adobe media caches and size up Final Cut Pro libraries full of render files, without losing your timelines.',
      why: 'Final Cut Pro libraries are listed with their size and a pointer to Final Cut’s own command (GuidanceCatalog.swift).',
    },
    { from: 'FCPX Render Files', to: 'FCPX Libraries', why: 'As above.' },
    {
      from: 'application logs, system caches, and partial downloads',
      to: 'application logs, app caches, and leftover update downloads',
      why: 'No partial-download rule exists; “App caches” (~/Library/Caches) and “App update downloads” do (AppCaches.swift).',
    },
    { from: 'Partial downloads', to: 'Update downloads', why: 'As above.' },
    {
      from: 'shows its size and the files inside before anything moves',
      to: 'shows its size and where it lives before anything moves',
      why: 'Review rows list items with a Reveal in Finder link, not the files inside (CatalogItemRows.swift).',
    },
    {
      from: 'Sent to the Trash, not erased',
      to: 'Your files go to the Trash',
      why: 'Regenerable items are deleted permanently (RESET.md Decision 3).',
    },
    {
      from: 'Cleaned items go to the Trash, so changing your mind',
      to: 'Caches that apps rebuild are deleted. Your files go to the Trash, so changing your mind',
      why: 'RESET.md Decision 3; this site’s Decision 23.',
    },
    {
      from: 'lets you review what it found, and clears it in one click',
      to: 'lets you review what it found, and clears it when you confirm',
      why: 'Clean up opens a review sheet that has to be confirmed (RESET.md Decision 27).',
    },
    {
      from: 'CacheDrop only recommends rebuildable caches and shows you each one before anything moves.',
      to: 'CacheDrop recommends caches that rebuild themselves and shows you each one before anything is cleared.',
      why: 'Smart clean also ticks old downloads and files left by deleted apps, which go to the Trash (RESET.md Decision 83).',
    },
    {
      from: 'alone, and sends what it clears to the Trash.',
      to: 'alone. It deletes only files apps make again, like caches, and sends your own files to the Trash.',
      why: 'RESET.md Decision 3.',
    },
  ],
  'clear-mac-developer-caches/index.html': [
    {
      from: 'Reclaim 50GB of forgotten code.',
      to: 'Reclaim gigabytes of forgotten code.',
      why: 'No measurement backs 50GB; the owner’s field scan found 3.5 GB of build folders and 17 GB of updater and package caches.',
    },
    {
      from: 'Homebrew, npm and Dart package caches',
      to: 'Homebrew, npm and Yarn package caches',
      why: 'The app has no Dart or .pub-cache rule; it has npm, Yarn and Homebrew rules (Catalog.swift).',
    },
    {
      from: 'CacheDrop shows DerivedData’s size in its Developer caches review, so you can see it and clear it in one click.',
      to: 'CacheDrop shows DerivedData’s size under Developer caches and build files, so you can see it and clear it when you confirm.',
      why: 'The category is “Developer caches and build files” (CatalogCleanup.swift); cleaning goes through a confirmed review.',
    },
    {
      from: 'CacheDrop finds them all and lets you drop them in one click.',
      to: 'CacheDrop finds them in the folders you choose and lets you pick which to drop.',
      why: 'Build folders are found only in folders added under Locations & access and are ticked one by one (ProjectBuilds.swift).',
    },
    {
      from: 'lists every node_modules folder with its size, so you can pick the ones to drop.',
      to: 'lists each node_modules folder with its size, so you can pick the ones to drop. It skips projects you changed this week, and what you drop goes to the Trash.',
      why: 'Projects changed in the last 7 days are held, and build folders are moved to the Trash (ProjectBuilds.swift).',
    },
    {
      from: 'CacheDrop groups these caches under Developer caches',
      to: 'CacheDrop groups the Docker, Homebrew and npm caches under Developer caches',
      why: '“These caches” included Dart’s .pub-cache, which the app doesn’t clean.',
    },
  ],
  'clear-adobe-media-cache-mac/index.html': [
    {
      from: 'Note: This only deletes caches for the open version of Premiere.',
      to: 'Note: Adobe suggests doing this right after you start Premiere, before you open a project.',
      why: 'Adobe documents the cache as one shared folder, not per version; its help says to delete all files right after starting Premiere.',
    },
    {
      from: 'CacheDrop scans your entire Library for every version of Adobe Premiere, After Effects, and Photoshop you’ve ever installed, and drops the caches in one click.',
      to: 'CacheDrop finds the media cache that Premiere Pro, After Effects and Media Encoder share, and clears it when you confirm. No need to open Premiere.',
      why: 'One rule covers the shared Adobe/Common media cache; there is no Photoshop rule and no per-version scan (AppDataCaches.swift).',
    },
    {
      from: 'CacheDrop safely analyzes your FCPX libraries and lets you strip out the heavy render files while keeping your project timeline intact.',
      to: 'CacheDrop finds your FCPX libraries, shows how much space each one takes, and points you to the Final Cut command that strips out the render files.',
      why: 'Final Cut Pro libraries are guidance only: sized whole, never changed (GuidanceCatalog.swift).',
    },
    { from: 'Clear them with CacheDrop', to: 'Find them with CacheDrop', why: 'As above.' },
    {
      from: 'CacheDrop lists the render files in each library it finds, with their size. Clear the heavy ones and your timelines, media and edits stay exactly as they were.',
      to: 'CacheDrop lists each Final Cut Pro library it finds with its size, so you know which ones to clean in Final Cut. It never changes a library itself.',
      why: 'As above.',
    },
    {
      from: 'Adobe Premiere Pro, After Effects and Photoshop (every installed version), plus Final Cut Pro render files.',
      to: 'Adobe Premiere Pro, After Effects and Media Encoder, which share one media cache. For Final Cut Pro, it shows each library’s size and how to delete its render files in Final Cut.',
      why: 'AppDataCaches.swift and GuidanceCatalog.swift.',
    },
    {
      from: 'Adobe media cache and Final Cut Pro render files in one scan',
      to: 'Adobe media cache and your Final Cut Pro libraries in one scan',
      why: 'As above.',
    },
  ],
};

/** The handoff page with its agreed copy fixes applied. Throws when a fix no longer matches, so a stale entry can't pass silently. */
export function withCopyFixes(handoffFile: string, html: string): string {
  for (const { from, to } of copyFixes[handoffFile] ?? []) {
    if (!html.includes(from)) throw new Error(`Copy fix for ${handoffFile} no longer matches: “${from}”`);
    html = html.replaceAll(from, to);
  }
  return html;
}
