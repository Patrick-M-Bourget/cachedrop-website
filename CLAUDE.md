# CacheDrop website (cachedrop.io)

Marketing site and beta download for CacheDrop, the Mac storage cleaner built in `Patrick-M-Bourget/mac-cleaner`. Astro on Vercel; Supabase (AWS US regions) stores signups, feedback and releases; Resend sends email.

`docs/DECISIONS.md` is the plan. Its decisions override anything else, including `handoff/HANDOFF.md`. The design authority is `handoff/`: the pages in `handoff/site/`, the brand guide in `handoff/design-system/README.md`, and the renders in `handoff/screenshots/`.

GitHub account: `Patrick-M-Bourget`. Run `gh auth status` before any `git push`.

## Workflow

- One logical change per commit and about 500 lines or less per PR. Run the tests and build before every commit.
- Push a branch, open a PR (`/pr`), and say what to smoke-test on its Vercel preview. Merge only after the user confirms.
- New or changed screens: attach screenshots at 1440 and 390 px to the PR for the user's approval. Commit no screenshots or evidence reports.
- Secrets (Supabase service key, Resend key, GitHub token, Turnstile secret) live only in Vercel and `.env.local`. Never commit them and never print them.
- Nothing is public on cachedrop.io until the launch ticket closes.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for Patrick-M-Bourget/cachedrop-website, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context. See `docs/agents/domain.md`.
