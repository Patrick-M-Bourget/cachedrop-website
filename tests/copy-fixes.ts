// The agreed copy changes against the handoff (Decision 23: claims match the app).
// The head diff and the same-browser screenshot compare the build with the handoff
// original after these replacements, so every other byte of copy still has to match.
// Each `from` is replaced everywhere in its page, which keeps visible FAQ text and the
// FAQPage JSON-LD in step.
export type CopyFix = { from: string; to: string; why: string };

export const copyFixes: Record<string, CopyFix[]> = {};

/** The handoff page with its agreed copy fixes applied. Throws when a fix no longer matches, so a stale entry can't pass silently. */
export function withCopyFixes(handoffFile: string, html: string): string {
  for (const { from, to } of copyFixes[handoffFile] ?? []) {
    if (!html.includes(from)) throw new Error(`Copy fix for ${handoffFile} no longer matches: “${from}”`);
    html = html.replaceAll(from, to);
  }
  return html;
}
