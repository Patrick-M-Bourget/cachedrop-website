// Deliberate departures from the handoff pages. The head diff and the same-browser
// screenshot test apply them to the handoff original before comparing, so the build
// must match the original plus these changes and nothing else. Two kinds:
// - the every-page changes below, each required by a decision in docs/DECISIONS.md;
//   every `find` must occur exactly once in a page, or the test fails;
// - each page's copy fixes in copy-fixes.ts (Decision 23: claims match the app).
import { withCopyFixes } from './copy-fixes';

export type HandoffChange = { decision: number; why: string; find: string; replace: string };

export const handoffChanges: HandoffChange[] = [
  {
    decision: 19,
    why: 'The footer links to the privacy policy on every page.',
    find: '<span>Public beta</span>',
    replace: '<span style="display: flex; gap: 16px"><a class="flink" href="/privacy/">Privacy Policy</a><span>Public beta</span></span>',
  },
  {
    decision: 43,
    why: 'The footer also links to the terms of sale, refund policy and license agreement, in a row that wraps.',
    find: '<span style="display: flex; gap: 16px"><a class="flink" href="/privacy/">Privacy Policy</a>',
    replace: '<span style="display: flex; flex-wrap: wrap; gap: 8px 16px"><a class="flink" href="/privacy/">Privacy Policy</a><a class="flink" href="/terms-of-sale/">Terms of Sale</a><a class="flink" href="/refund-policy/">Refund Policy</a><a class="flink" href="/license-agreement/">License Agreement</a>',
  },
  {
    decision: 5,
    why: 'The footer switches to the page in French. Applied after the Decision 19 change, so it ends the same row.',
    find: '<span>Public beta</span>',
    replace: '<span>Public beta</span><a class="flink" href="/fr/" hreflang="fr" lang="fr">Français</a>',
  },
  {
    decision: 42,
    why: 'The footer\'s Product column links to the page that re-sends a license key.',
    find: '<a class="flink" href="#feedback" data-feedback>Provide Feedback</a>',
    replace: '<a class="flink" href="#feedback" data-feedback>Provide Feedback</a><a class="flink" href="/resend-license-key/">Resend License Key</a>',
  },
  {
    decision: 54,
    why: 'The footer\'s Product column links to the CleanMyMac alternative page after Resend License Key. Applied after the Decision 42 change.',
    find: '<a class="flink" href="/resend-license-key/">Resend License Key</a>',
    replace: '<a class="flink" href="/resend-license-key/">Resend License Key</a><a class="flink" href="/cleanmymac-alternative/">Compare to CleanMyMac</a>',
  },
  {
    decision: 48,
    why: 'The nav links to the producer page after For Creators.',
    find: 'For Creators</a>',
    replace: 'For Creators</a><a class="navlink" href="/uninstall-audio-plugins-mac/">For Music Producers</a>',
  },
  {
    decision: 48,
    why: 'The footer\'s Cleaning Guides column links to the producer page after the two guides.',
    find: '<a class="flink" href="/clear-adobe-media-cache-mac/">Clear Adobe Media Cache</a>',
    replace: '<a class="flink" href="/clear-adobe-media-cache-mac/">Clear Adobe Media Cache</a><a class="flink" href="/uninstall-audio-plugins-mac/">Uninstall Audio Plug-ins</a>',
  },
  {
    decision: 51,
    why: 'The footer\'s Cleaning Guides column links to the app uninstall guide (#111) after the producer page. Applied after the Decision 48 change.',
    find: '<a class="flink" href="/uninstall-audio-plugins-mac/">Uninstall Audio Plug-ins</a>',
    replace: '<a class="flink" href="/uninstall-audio-plugins-mac/">Uninstall Audio Plug-ins</a><a class="flink" href="/uninstall-apps-mac/">Uninstall Apps</a>',
  },
  {
    decision: 44,
    why: 'The nav links to /pricing/ after For Music Producers. Applied after the Decision 48 change.',
    find: 'For Music Producers</a>',
    replace: 'For Music Producers</a><a class="navlink" href="/pricing/">Pricing</a>',
  },
  {
    decision: 52,
    why: 'The beta is over: the nav loses its BETA badge.',
    find: '<span style="font-size: 10px; font-weight: 600; letter-spacing: 0.06em; color: #6E6E73; background: #F5F5F7; border-radius: 9999px; padding: 2px 7px">BETA</span>',
    replace: '',
  },
  {
    decision: 51,
    why: 'The nav button has the one label for buttons to /download/.',
    find: 'Get Free Beta</a>',
    replace: 'Download for Mac</a>',
  },
  {
    decision: 51,
    why: 'So does the footer\'s download link.',
    find: '<a class="flink" href="/download/">Download Free Beta</a>',
    replace: '<a class="flink" href="/download/">Download for Mac</a>',
  },
  {
    decision: 51,
    why: 'The footer\'s Cleaning Guides column links to the System Data guide after the producer page (#110).',
    find: '<a class="flink" href="/uninstall-audio-plugins-mac/">Uninstall Audio Plug-ins</a>',
    replace: '<a class="flink" href="/uninstall-audio-plugins-mac/">Uninstall Audio Plug-ins</a><a class="flink" href="/clear-system-data-mac/">Clear System Data</a>',
  },
  {
    decision: 51,
    why: 'The footer\'s tagline says what the homepage says (#109).',
    find: '>A careful Mac storage cleaner for developer caches and creative render files.</p>',
    replace: '>Get your Mac’s space back: a cleaner, app uninstaller and plug-in manager you pay for once.</p>',
  },
  {
    decision: 52,
    why: 'The footer\'s "Public beta" label goes with the badge. Applied last: the Decision 19 and 5 changes anchor on it.',
    find: '<span>Public beta</span>',
    replace: '',
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

/**
 * The handoff page as the build should render it: its copy fixes, then the every-page changes.
 * `handoffFile` is relative to handoff/site/, e.g. `clear-mac-developer-caches/index.html`.
 */
export function withHandoffChanges(handoffFile: string, html: string) {
  return applyHandoffChanges(withCopyFixes(handoffFile, html), handoffFile);
}
