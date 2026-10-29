-- Unsubscribe meets the news opt-in (#9 + #10, Decisions 3, 4, 32), written when both merged.
--
-- 1. unsubscribe() also turns the news opt-in off, so the do-not-email marker really is only the
--    address and unsubscribed_at. news_opt_in and news_opt_in_at change together, as #9's check
--    constraint (signups_news_opt_in_at) requires.
-- 2. request_download() with a fresh tick (p_news = true) is new consent: it clears unsubscribed_at,
--    so update and news emails resume. Without the tick the person stays unsubscribed.
-- The three-argument request_download wrapper (#9) is left as it is: it calls the function below
-- with p_news = false, so it never re-consents anyone.

create or replace function public.unsubscribe(p_token_hash text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.signups
  set unsubscribed_at = coalesce(unsubscribed_at, now()),
      filling = null,
      news_opt_in = false,
      news_opt_in_at = null
  where id = (select signup_id from public.unsubscribe_tokens where token_hash = p_token_hash);
  return found;
end;
$$;

create or replace function public.request_download(p_email text, p_filling text, p_news boolean, p_token_hash text)
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
        news_opt_in_at = case when signups.news_opt_in then signups.news_opt_in_at else now() end,
        unsubscribed_at = null
    where p_news
  returning id into signup_id;

  if signup_id is null then
    select id into signup_id from public.signups where email = p_email;
  end if;

  insert into public.download_tokens (token_hash, signup_id) values (p_token_hash, signup_id);
end;
$$;

-- Addresses that unsubscribed before this migration keep no opt-in either.
update public.signups
set news_opt_in = false, news_opt_in_at = null
where unsubscribed_at is not null and news_opt_in;

-- create or replace keeps the existing grants; restated so this file stands on its own.
revoke execute on function public.unsubscribe(text) from public, anon, authenticated;
revoke execute on function public.request_download(text, text, boolean, text) from public, anon, authenticated;
grant execute on function public.unsubscribe(text) to service_role;
grant execute on function public.request_download(text, text, boolean, text) to service_role;
