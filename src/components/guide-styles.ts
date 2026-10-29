// Inline style strings the two cleaning guides share with each other and with the other pages,
// ported from the handoff with literals swapped for tokens (Decision 11). Values with no token stay
// literal.

/** The design system's `title-md` (18/24, 600): card and step titles, the feedback modal's title. */
export const titleMd = 'margin: 0; font-size: 18px; line-height: 24px; font-weight: 600; letter-spacing: -0.01em';

/** One FAQ row, ruled above, and below the last one. */
export const faqItem = (i: number, count: number) =>
  `padding: var(--space-6) 0; border-top: 1px solid var(--line)${i === count - 1 ? '; border-bottom: 1px solid var(--line)' : ''}`;

/** An FAQ question (H3). */
export const faqQuestion = 'margin: 0; font-size: 18px; line-height: 26px; font-weight: 600; letter-spacing: -0.01em';

/** Section heading (H2) in the guide body. */
export const guideH2 = 'margin: 0; font-size: clamp(26px, 3vw, 34px); line-height: 1.2; font-weight: 600; letter-spacing: -0.025em';

/** Body paragraph in the guide body. */
export const guideP = 'margin: 0; font-size: 17px; line-height: 28px; color: var(--ink-body)';

/** A numbered section with its heading, steps and code blocks spaced evenly. */
export const guideSection = 'padding-top: var(--space-18); display: flex; flex-direction: column; gap: var(--space-5)';

/** The large primary download button used in the hero and the closing call to action. */
export const primaryLg = 'display: inline-flex; align-items: center; gap: var(--space-2-5); height: var(--control-lg); padding: 0 var(--space-6); border-radius: var(--radius-full); background: var(--accent); font-size: 15px; font-weight: 500; box-shadow: var(--shadow-button)';

/** "Get CacheDrop free" style text link with a trailing arrow. */
export const arrowLink = 'display: inline-flex; align-items: center; gap: var(--space-1-5); font-size: 15px; font-weight: 500; color: var(--accent-text)';
