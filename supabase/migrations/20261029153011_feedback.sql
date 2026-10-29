-- Feedback (Decisions 6, 9, 10): one row per submission of the feedback modal. api/feedback saves
-- the row, files a mac-cleaner issue and stores its number; api/feedback-retry files the issue
-- for rows that have none. The email stays here only (Decision 9) and never goes to GitHub.

create table public.feedback (
  id bigint generated always as identity primary key,
  rating text check (rating in ('angry', 'meh', 'neutral', 'happy', 'love')),
  -- Optional; kept for replying by hand.
  email text check (email = lower(email) and char_length(email) between 3 and 254),
  message text not null default '' check (char_length(message) <= 5000),
  page text not null check (page ~ '^/' and char_length(page) <= 200),
  -- { userAgent, platform, language }, only when the person ticked the box (Decision 10).
  specs jsonb check (specs is null or jsonb_typeof(specs) = 'object'),
  issue_number integer check (issue_number > 0),
  created_at timestamptz not null default now(),
  check (rating is not null or message <> '')
);

comment on table public.feedback is 'Feedback modal submissions; issue_number is the mac-cleaner issue filed for each (Decision 6).';

-- What the retry looks for.
create index feedback_without_issue on public.feedback (id) where issue_number is null;

-- Browsers never touch this table (Decision 12): RLS on with no policies, and no grants to the
-- public roles. The service role bypasses RLS.
alter table public.feedback enable row level security;
revoke all on table public.feedback from anon, authenticated;

-- Saves a submission and returns its id.
create function public.save_feedback(p_rating text, p_email text, p_message text, p_page text, p_specs jsonb)
returns bigint
language sql
security invoker
set search_path = ''
as $$
  insert into public.feedback (rating, email, message, page, specs)
  values (p_rating, p_email, p_message, p_page, p_specs)
  returning id;
$$;

-- Stores the issue filed for a row. Never overwrites one already stored.
create function public.set_feedback_issue(p_id bigint, p_issue_number integer)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.feedback set issue_number = p_issue_number where id = p_id and issue_number is null;
$$;

-- Rows created before p_created_before that still have no issue, oldest first, without the email.
create function public.feedback_without_issue(p_created_before timestamptz, p_limit integer)
returns table (id bigint, rating text, has_email boolean, message text, page text, specs jsonb, created_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select f.id, f.rating, f.email is not null, f.message, f.page, f.specs, f.created_at
  from public.feedback f
  where f.issue_number is null and f.created_at < p_created_before
  order by f.id
  limit p_limit;
$$;

revoke execute on function public.save_feedback(text, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.set_feedback_issue(bigint, integer) from public, anon, authenticated;
revoke execute on function public.feedback_without_issue(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.save_feedback(text, text, text, text, jsonb) to service_role;
grant execute on function public.set_feedback_issue(bigint, integer) to service_role;
grant execute on function public.feedback_without_issue(timestamptz, integer) to service_role;
