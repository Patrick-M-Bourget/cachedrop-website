-- Campaign tags with each signup (#93, approved by the owner 2026-11-03): the utm_* parameters of
-- the ad or link that brought the visitor, so ad results can be read from signups. Each is optional
-- and at most 150 characters. The first values win: a later download request for the same address
-- keeps them, and only a signup with none takes new ones. They are kept as long as the signup, and an
-- unsubscribe wipes them with the rest of the signup, leaving the do-not-email marker (Decision 32).

alter table public.signups
  add column utm_source text check (char_length(utm_source) between 1 and 150),
  add column utm_medium text check (char_length(utm_medium) between 1 and 150),
  add column utm_campaign text check (char_length(utm_campaign) between 1 and 150),
  add column utm_content text check (char_length(utm_content) between 1 and 150),
  add column utm_term text check (char_length(utm_term) between 1 and 150);

comment on column public.signups.utm_source is 'utm_source of the first campaign that brought this signup (#93).';

-- The request now carries the tags. The old five-argument function is dropped so PostgREST never
-- picks it by mistake; the website must ship with this migration applied.
drop function public.request_download(text, text, boolean, text, text);

create function public.request_download(
  p_email text,
  p_filling text,
  p_news boolean,
  p_lang text,
  p_token_hash text,
  p_utm_source text default null,
  p_utm_medium text default null,
  p_utm_campaign text default null,
  p_utm_content text default null,
  p_utm_term text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  signup_id bigint;
begin
  insert into public.signups (email, filling, news_opt_in, news_opt_in_at, lang,
                              utm_source, utm_medium, utm_campaign, utm_content, utm_term)
  values (p_email, p_filling, p_news, case when p_news then now() end, coalesce(p_lang, 'en'),
          p_utm_source, p_utm_medium, p_utm_campaign, p_utm_content, p_utm_term)
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

  -- First touch wins: an existing signup takes the tags only when it has none at all. An unsubscribed
  -- marker keeps none; the upsert above has already cleared unsubscribed_at for a fresh tick.
  update public.signups
  set utm_source = p_utm_source, utm_medium = p_utm_medium, utm_campaign = p_utm_campaign,
      utm_content = p_utm_content, utm_term = p_utm_term
  where id = signup_id
    and unsubscribed_at is null
    and utm_source is null and utm_medium is null and utm_campaign is null and utm_content is null and utm_term is null;

  insert into public.download_tokens (token_hash, signup_id) values (p_token_hash, signup_id);
end;
$$;

revoke execute on function public.request_download(text, text, boolean, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.request_download(text, text, boolean, text, text, text, text, text, text, text) to service_role;

-- Unsubscribe wipes the tags too: the marker keeps only the address and unsubscribed_at.
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
      lang = 'en',
      utm_source = null,
      utm_medium = null,
      utm_campaign = null,
      utm_content = null,
      utm_term = null
  where id = (select signup_id from public.unsubscribe_tokens where token_hash = p_token_hash);
  return found;
end;
$$;

revoke execute on function public.unsubscribe(text) from public, anon, authenticated;
grant execute on function public.unsubscribe(text) to service_role;
