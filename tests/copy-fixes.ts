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
};

/** The handoff page with its agreed copy fixes applied. Throws when a fix no longer matches, so a stale entry can't pass silently. */
export function withCopyFixes(handoffFile: string, html: string): string {
  for (const { from, to } of copyFixes[handoffFile] ?? []) {
    if (!html.includes(from)) throw new Error(`Copy fix for ${handoffFile} no longer matches: “${from}”`);
    html = html.replaceAll(from, to);
  }
  return html;
}
