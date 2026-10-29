-- The rest of the email gate's rules (Decisions 2, 3): the news opt-in on each signup, and a daily
-- job that deletes tokens 30 days after they expire.

-- The news opt-in (Decision 3): an unticked box, so false until someone ticks it. news_opt_in_at is
-- when the current yes was given (CASL consent record); null while it is no.
alter table public.signups
  add column news_opt_in boolean not null default false,
  add column news_opt_in_at timestamptz,
  add constraint signups_news_opt_in_at check (news_opt_in = (news_opt_in_at is not null));

comment on column public.signups.news_opt_in is 'Ticked "Email me news about CacheDrop" (Decision 3). Never pre-ticked.';
comment on column public.signups.news_opt_in_at is 'When the current yes was given; null while news_opt_in is false.';

-- Saves the signup (or finds the existing one for this email), records a new token for it, and
-- turns the opt-in on when p_news is true. A request with p_news false never turns a yes off.
create function public.request_download(p_email text, p_filling text, p_news boolean, p_token_hash text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  signup_id bigint;
begin
  insert into public.signups (email, filling, news_opt_in, news_opt_in_at)
  values (p_email, p_filling, p_news, case when p_news then now() end)
  on conflict (email) do update
    set news_opt_in = true,
        news_opt_in_at = case when signups.news_opt_in then signups.news_opt_in_at else now() end
    where p_news
  returning id into signup_id;

  if signup_id is null then
    select id into signup_id from public.signups where email = p_email;
  end if;

  insert into public.download_tokens (token_hash, signup_id) values (p_token_hash, signup_id);
end;
$$;

-- The three-argument version stays for previews built before this migration, which share the dev
-- database. It never opts anyone in. Drop it once every deployment calls the one above.
create or replace function public.request_download(p_email text, p_filling text, p_token_hash text)
returns void
language sql
security invoker
set search_path = ''
as $$
  select public.request_download(p_email, p_filling, false, p_token_hash);
$$;

-- Deletes tokens more than 30 days past their expiry (Decision 2) and returns how many it deleted.
create function public.delete_expired_tokens()
returns integer
language sql
security invoker
set search_path = ''
as $$
  with gone as (
    delete from public.download_tokens where expires_at < now() - interval '30 days' returning 1
  )
  select count(*)::integer from gone;
$$;

revoke execute on function public.request_download(text, text, boolean, text) from public, anon, authenticated;
revoke execute on function public.delete_expired_tokens() from public, anon, authenticated;
grant execute on function public.request_download(text, text, boolean, text) to service_role;
grant execute on function public.delete_expired_tokens() to service_role;

-- The scheduled job: daily at 04:17 UTC, with Supabase's pg_cron.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('delete-expired-tokens', '17 4 * * *', 'select public.delete_expired_tokens()');
