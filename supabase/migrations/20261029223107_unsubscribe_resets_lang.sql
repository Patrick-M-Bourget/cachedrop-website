-- Unsubscribe resets the stored language (Decisions 32, 34): the do-not-email marker keeps only the
-- address and unsubscribed_at, so the signup's language goes back to the default, 'en', in the same
-- update as the rest. A later download request stores its page's language again (#14).

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
      news_opt_in_at = null,
      lang = 'en'
  where id = (select signup_id from public.unsubscribe_tokens where token_hash = p_token_hash);
  return found;
end;
$$;

-- Addresses that unsubscribed before this migration keep no language either.
update public.signups set lang = 'en' where unsubscribed_at is not null and lang <> 'en';

-- create or replace keeps the existing grants; restated so this file stands on its own.
revoke execute on function public.unsubscribe(text) from public, anon, authenticated;
grant execute on function public.unsubscribe(text) to service_role;
