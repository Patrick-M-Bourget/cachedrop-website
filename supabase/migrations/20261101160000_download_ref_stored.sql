-- save_download_ref answers whether it stored the code (Decision 39), so /api/download appends only a
-- code that is stored: a token row deleted between the lookup and the save stores nothing.
drop function public.save_download_ref(text, text);

create function public.save_download_ref(p_ref text, p_token_hash text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.download_refs (ref, signup_id)
  select p_ref, signup_id from public.download_tokens where token_hash = p_token_hash;
  return found;
end;
$$;

revoke execute on function public.save_download_ref(text, text) from public, anon, authenticated;
grant execute on function public.save_download_ref(text, text) to service_role;

comment on table public.telemetry_events is 'Opt-in setup progress from the app, one row per install ID and event (Decisions 38, 39). signup_id only through a per-download code; no IP; rows go after 13 months.';
