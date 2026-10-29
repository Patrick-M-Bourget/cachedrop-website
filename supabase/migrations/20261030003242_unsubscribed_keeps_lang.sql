-- An unsubscribed signup is a do-not-email marker: the address and unsubscribed_at, nothing else
-- (Decisions 32, 34). A later download request without the tick sends its email in the request's
-- language but no longer writes that language back onto the marker. A fresh tick is new consent
-- (#10), so it stores the language again along with clearing the unsubscribe.

create or replace function public.request_download(p_email text, p_filling text, p_news boolean, p_lang text, p_token_hash text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  signup_id bigint;
begin
  insert into public.signups (email, filling, news_opt_in, news_opt_in_at, lang)
  values (p_email, p_filling, p_news, case when p_news then now() end, coalesce(p_lang, 'en'))
  on conflict (email) do update
    set lang = case
          when signups.unsubscribed_at is not null and not p_news then signups.lang
          else coalesce(p_lang, signups.lang)
        end,
        news_opt_in = signups.news_opt_in or p_news,
        news_opt_in_at = case
          when p_news and not signups.news_opt_in then now()
          else signups.news_opt_in_at
        end,
        unsubscribed_at = case when p_news then null else signups.unsubscribed_at end
  returning id into signup_id;

  insert into public.download_tokens (token_hash, signup_id) values (p_token_hash, signup_id);
end;
$$;

-- create or replace keeps the existing grants; restated so this file stands on its own.
revoke execute on function public.request_download(text, text, boolean, text, text) from public, anon, authenticated;
grant execute on function public.request_download(text, text, boolean, text, text) to service_role;
