# Privacy impact assessment: providers outside Quebec

**Status: draft** for the owner and the lawyer (Decisions 20, 22). Not legal advice. Written 2026-10-29 from `docs/DECISIONS.md`; launch blocks on it (Decision 26).

## Why this exists

Law 25 (art. 17 of the private-sector Act) asks for an assessment before personal information is communicated outside Quebec. It weighs:

- how sensitive the information is,
- why it is sent,
- the protection measures, contractual ones included,
- the legal framework where it goes.

The transfer must also be covered by a written agreement that reflects the result. **To confirm with the lawyer:** that the providers' standard terms (below) count as that agreement.

## What the site handles

Low-sensitivity information only:

- email address, optional "What's filling your Mac?" answer, optional news opt-in (signups);
- feedback: rating, message, page, optional email;
- optional system specs: the browser's user agent, platform and language (`site.js` today; the checkbox becomes unchecked by default under Decision 10);
- download tokens, download counts, cookieless page-visit counts;
- IP addresses, for spam checks and per-IP rate limits (Decision 12). The IP itself is never stored: the rate limit keeps an HMAC of it (keyed with the Supabase service key; IPv6 by /64) for at most a day;
- the content of emails people send to `privacy@` and `hello@cachedrop.io`.

No payment details, no passwords, no health or financial information, no account.

## Providers outside Quebec

### Supabase

Decision 31 amends 13: the projects are in the United States, not Montreal.

- **Data:** the most sensitive set on this list, because it is stored rather than passed through: signup email addresses, the optional "What's filling your Mac?" answer, the news opt-in, feedback (rating, message, page, optional email), optional specs, download tokens, download counts, rate-limit counters keyed by an HMAC of the IP (kept a day at most), and the released DMGs.
- **Why:** the site's database and file storage (Decisions 13, 15).
- **Where:** United States. `cachedrop-dev` is in `us-east-1` (AWS N. Virginia) and `cachedrop-prod` in `us-west-2` (AWS Oregon). The owner chose to keep them there (Decision 31).
- **Technical safeguards:** the service key lives only in the Vercel functions (Decision 12, CLAUDE.md); browsers never touch Supabase. Row Level Security is on with no policies and no grants to the public roles, so only the service key can read or write. The `releases` bucket is private: files are reachable only with the service key or a short-lived signed URL. These are in the releases migration (#7), and the signups and feedback tables follow the same pattern, as do the download token, unsubscribe token and rate-limit tables (their migrations in `supabase/migrations/`). HTTPS only.
- **Contractual safeguards:** Supabase's Data Processing Agreement. **Owner to confirm** that it has been accepted for the organisation that holds both projects.
- **Conclusion (draft):** acceptable, given the access controls above and the DPA once confirmed. The stored set is still low-sensitivity, but it is the largest and longest-kept, so it carries most of this assessment's weight.

### Vercel

- **Data:** every request to the site (IP address, user agent, URL); form submissions in transit through the functions (email, feedback, specs); page-visit counts (Vercel Web Analytics).
- **Why:** hosts the site, runs the functions that hold the Supabase service key (Decision 12), counts visits (Decision 16).
- **Where:** Vercel's global edge network; functions run in the region the project sets (to check: default is the United States).
- **Technical safeguards:** functions pass form data to Supabase and don't store it. Analytics uses no cookies, and `beforeSend` strips the token from `/download/<token>` URLs (Decision 16). Secrets live only in Vercel's environment (CLAUDE.md). HTTPS only.
- **Contractual safeguards:** to check: Vercel's Data Processing Addendum and its privacy terms, on the Pro plan used at launch (Decision 17).
- **Conclusion (draft):** acceptable. The data is low-sensitivity, mostly in transit, and analytics is anonymous by design.

### Resend

- **Data:** the recipient's email address and the email content (download link, update and security notices, news for opt-ins).
- **Why:** sends all email from `cachedrop.io` (Decision 14).
- **Where:** to check: the region of the Resend account (the default is the United States).
- **Technical safeguards:** only the address and the message go to Resend; the signup row stays in Supabase. Download links carry a token that expires after 7 days (Decision 2). SPF and DKIM on `cachedrop.io`.
- **Contractual safeguards:** to check: Resend's Data Processing Agreement and its sub-processors.
- **Conclusion (draft):** acceptable. Sending an email requires the address; nothing more is sent.

### Cloudflare

Two purposes (Decision 29 amends 18).

1. **Turnstile** on the email gate and the feedback form (Decision 12).
   - **Data:** browser signals and the IP address of the person submitting the form.
   - **Why:** stops bots and abuse of the free email gate and feedback.
2. **Email Routing** for `privacy@` and `hello@cachedrop.io`.
   - **Data:** the full email: sender address, subject, body and attachments. Mail passes through Cloudflare on its way to the owner's inbox. This can include privacy requests, so it may be the most sensitive flow on this list.
   - **Why:** gives the site role addresses without publishing the owner's personal email.

- **Where:** Cloudflare's global network.
- **Technical safeguards:** Turnstile runs only on forms: Cloudflare's script loads on `/download/` and, elsewhere, only when the feedback modal opens. Its widget stays invisible unless Cloudflare needs a click. Email Routing forwards and doesn't keep a mailbox (to check in Cloudflare's docs). DNS-only records for the site (Decision 29), so site traffic doesn't go through Cloudflare.
- **Contractual safeguards:** to check: Cloudflare's Data Processing Addendum, on the Free plan.
- **Conclusion (draft):** acceptable, with one point for the lawyer: whether forwarded privacy requests need anything more, such as replying from a provider in Canada.

### GitHub

- **Data:** each feedback submission becomes an issue in `Patrick-M-Bourget/mac-cleaner` with the rating, message, page and specs, **never the email** (Decision 6). Website-only feedback is moved by hand to this repository at triage.
- **Why:** feedback becomes work the owner triages (Decisions 6, 7).
- **Where:** United States.
- **Launch dependency:** `mac-cleaner` is public today (checked 2026-10-29). It is made private before launch, and launch (#17) blocks on it (Decision 30). This assessment and the privacy policy describe that launch state: feedback issues are private. Until then, only test feedback from previews reaches the repository.
- **Technical safeguards:** the repository is private (Decision 30). The email never leaves Supabase. The token can only write issues to that one repository (Decision 8). Specs are opt-in (Decision 10). A person could still type personal details into the message.
- **Contractual safeguards:** to check: GitHub's terms and Data Protection Agreement.
- **Conclusion (draft):** acceptable once the repository is private.

## The legal framework where the data goes

Most of these providers are United States companies. US law can give US authorities access to data those companies hold (for example, the CLOUD Act). Given the low sensitivity of the data, this draft treats that risk as acceptable. **For the lawyer to confirm.**

## Launch dependencies

- [ ] `Patrick-M-Bourget/mac-cleaner` is private (Decision 30; launch #17 blocks on it). Until it is, the GitHub section above doesn't hold.

## Open items before launch

- [ ] The lawyer reviews this assessment and the policy (Decision 22).
- [ ] Each provider's data processing terms are read and recorded here.
- [ ] Vercel function region and Resend region are checked.
- [ ] The owner confirms Supabase's Data Processing Agreement is accepted (Decision 31).
- [ ] Feedback retention: the decisions set none (specs are kept with their feedback). The owner picks a period, or "until deleted on request".
- [ ] The specs checkbox starts unchecked (Decision 10, #11), and its label matches what is sent: today it says "Mac model, macOS version" but `site.js` sends the user agent, platform and language.
