// The agreed copy changes against the handoff: claims that match the app (Decision 23), and the
// copy that replaced the beta's (Decisions 44, 47, 51 and 52). The homepage is a new layout (#109)
// with its own reference renders, so it has no fixes here.
// The head diff and the same-browser screenshot compare the build with the handoff
// original after these replacements, so every other byte of copy still has to match.
// Each `from` is replaced everywhere in its page, which keeps visible FAQ text and the
// FAQPage JSON-LD in step. Checked against mac-cleaner main at 5bf77c7 on 2026-10-29.
// The platform claim is the handoff's own again (Decision 46): CacheDrop 1.0.1 is universal, macOS 14 or later.
import { compareLive, pricingCopy } from '../src/components/pricing';

export type CopyFix = { from: string; to: string; why: string };

/** The guides' closing line: the trial is stated once, under the hero button (Decision 51, #112). */
const guideClosing: CopyFix = { from: 'in one scan. Free while in beta.', to: 'in one scan.', why: 'Decision 51: the trial is stated once, under the primary button, so the closing line drops it (#112).' };

/** The download block under each guide's hero button (#112): the trial line, then the price for up to 3 Macs. */
const guideDownloadBlock = (note: string, newNote: string): CopyFix => ({
  from: `${note}</span>\n</div>\n`,
  to:
    `${newNote}</span>\n</div>\n` +
    `<p style="margin: 18px 0 0; font-size: 13px; color: #6E6E73">${pricingCopy.en.trial}</p>\n` +
    `<p style="margin: 6px 0 0; font-size: 13px; color: #6E6E73">Up to 3 Macs: ${pricingCopy.en.license}.` +
    (compareLive.en ? ` · <a class="textlink" href="/cleanmymac-alternative/" style="color: #0066CC">${pricingCopy.en.compare}</a>` : '') +
    `</p>\n`,
  why: '#112 (Decision 51): every guide has the same download block. The trial line, with macOS 14, sits under the button, so the note beside it drops “macOS 14+”. Decision 54 adds the compare page link after the price.',
});

export const copyFixes: Record<string, CopyFix[]> = {
  'clear-mac-developer-caches/index.html': [
    {
      from: 'Reclaim 50GB of forgotten code.',
      to: 'How to clear Xcode DerivedData, node_modules and Docker caches on Mac',
      why: '#112 (Decision 51): the H1 and Article headline repeat the search.',
    },
    {
      from: 'If you write code on a Mac, your biggest space hog',
      to: 'Reclaim gigabytes of forgotten code. If you write code on a Mac, your biggest space hog',
      why: '#112: the benefit moves to the lede. No measurement backs 50GB; the owner’s field scan found 3.5 GB of build folders and 17 GB of updater and package caches.',
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
    { from: '<span>Download CacheDrop (Free)</span>', to: '<span>Download for Mac</span>', why: 'Decision 51: the hero and closing buttons.' },
    guideDownloadBlock('Developer Mac cleaner · macOS 14+ · Apple Silicon &amp; Intel', 'Developer Mac cleaner · Apple Silicon &amp; Intel'),
    guideClosing,
  ],
  'clear-adobe-media-cache-mac/index.html': [
    { from: 'Stop buying external drives.', to: 'How to clear the Adobe media cache on Mac', why: '#112 (Decision 51): the H1 and Article headline repeat the search.' },
    {
      from: 'Video editing software generates massive, invisible cache files to keep playback smooth. When the project is over, those files stay on your Mac forever. CacheDrop finds them.',
      to: 'Stop buying external drives. When Premiere Pro or Final Cut Pro says your storage is full, it’s often cache files: video editing software generates massive, invisible caches to keep playback smooth, and when the project is over they stay on your Mac forever. CacheDrop finds them.',
      why: '#112: the benefit moves to the lede, with the “Final Cut Pro storage full” search in plain words.',
    },
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
    { from: '<span>Get Your Space Back (Free)</span>', to: '<span>Download for Mac</span>', why: 'Decision 51: the hero and closing buttons.' },
    { from: 'Get CacheDrop free', to: 'Try CacheDrop', why: 'Decision 51: the inline link to /download/.' },
    guideDownloadBlock('Premiere Pro · After Effects · Final Cut Pro · macOS 14+', 'Premiere Pro · After Effects · Final Cut Pro'),
    guideClosing,
  ],
  'download/index.html': [
    {
      from: 'Download the free CacheDrop beta for Mac: a universal app',
      to: 'Download CacheDrop for Mac: a universal app',
      why: 'Decisions 44 and 51: the description drops “beta” and “free to try”.',
    },
    { from: 'Thanks for trying the CacheDrop beta.', to: 'Thanks for trying CacheDrop.', why: 'Decision 52.' },
    { from: 'CacheDrop is free while in beta.', to: 'CacheDrop is free to try.', why: 'Decision 44.' },
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
