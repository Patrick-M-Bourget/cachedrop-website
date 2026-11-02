// Shared pieces of the sale pages (Decision 43): the terms of sale, the refund policy and the
// license agreement. Their copy is HTML strings, so links are built here once.

/** One section of a legal page. Each body entry is a paragraph (HTML) or a bullet list. */
export type LegalSection = {
  id: string;
  title: string;
  body: Array<string | LegalItem[]>;
};

/** A bullet: plain HTML, or [bold lead, rest as HTML], as on the privacy page. */
export type LegalItem = string | [lead: string, rest: string];

const linkStyle = 'color: var(--accent-text); font-weight: 500';

/** A mailto link styled like the privacy page's. */
export const mail = (address: string) => `<a class="textlink" href="mailto:${address}" style="${linkStyle}">${address}</a>`;

/** An inline text link; `href` is root-relative (already localized) or absolute. */
export const link = (href: string, text: string) => `<a class="textlink" href="${href}" style="${linkStyle}">${text}</a>`;

/** Sales, refund and license questions go to the general mailbox (Decision 29); there is no sales@ or support@. */
export const HELLO = 'hello@cachedrop.io';
