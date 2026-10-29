// Deliberate departures from the handoff pages, each required by a decision in
// docs/DECISIONS.md. The same-browser screenshot test applies them to the handoff
// original before comparing, so the build must match the original plus these changes
// and nothing else. Every `find` must occur exactly once in a page, or the test fails.
export type HandoffChange = { decision: number; why: string; find: string; replace: string };

export const handoffChanges: HandoffChange[] = [
  {
    decision: 19,
    why: 'The footer links to the privacy policy on every page.',
    find: '<span>Public beta</span>',
    replace: '<span style="display: flex; gap: 16px"><a class="flink" href="/privacy/">Privacy Policy</a><span>Public beta</span></span>',
  },
];

/** Returns the handoff page's HTML with every decided change applied. */
export function applyHandoffChanges(html: string, page: string) {
  for (const c of handoffChanges) {
    const count = html.split(c.find).length - 1;
    if (count !== 1) throw new Error(`Decision ${c.decision} change expects "${c.find}" once in ${page}, found ${count}`);
    html = html.replace(c.find, c.replace);
  }
  return html;
}
