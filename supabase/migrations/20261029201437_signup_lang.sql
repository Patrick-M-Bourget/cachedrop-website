-- Emails go out in the language the person signed up in (Decision 5, #14). Each signup stores the
-- language of the page its latest request came from: a later request from the other language
-- switches it, so update and news emails follow the page the person last used.

alter table public.signups
  add column lang text not null default 'en' check (lang in ('en', 'fr'));

comment on column public.signups.lang is 'Language of the latest download request''s page, en or fr (Decision 5).';

-- request_download with the page's language. Same opt-in and re-consent rules as before (#9, #10):
-- a tick turns the opt-in on and clears an unsubscribe; no tick changes neither. p_lang null keeps
-- the stored language (English for a new signup), which is what the older calls below pass.
create function public.request_download(p_email text, p_filling text, p_news boolean, p_lang text, p_token_hash text)
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
    set lang = coalesce(p_lang, signups.lang),
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

-- The four-argument version stays for previews built before this migration, which share the dev
-- database. It never changes a stored language. Drop it once every deployment calls the one above.
create or replace function public.request_download(p_email text, p_filling text, p_news boolean, p_token_hash text)
returns void
language sql
security invoker
set search_path = ''
as $$
  select public.request_download(p_email, p_filling, p_news, null, p_token_hash);
$$;

revoke execute on function public.request_download(text, text, boolean, text, text) from public, anon, authenticated;
revoke execute on function public.request_download(text, text, boolean, text) from public, anon, authenticated;
grant execute on function public.request_download(text, text, boolean, text, text) to service_role;
grant execute on function public.request_download(text, text, boolean, text) to service_role;
