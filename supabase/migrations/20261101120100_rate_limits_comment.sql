-- The rate limit now also counts the app's setup progress, which has no Turnstile (Decision 38), so
-- the table comment from *_rate_limits.sql no longer says only form submissions.
comment on table public.rate_limits is 'Requests per keyed IP hash per window: the two forms after Turnstile, and the app''s setup progress (Decisions 12, 38). Never holds an IP; rows go after a day.';
