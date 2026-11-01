-- Per-download codes (Decision 39, #60; amends Decisions 2 and 38). Each download start gets a fresh
-- random code that api/download appends to the signed URL as &ref=, so the browser records it on the
-- DMG and the app can send it with its setup progress. The code is not the token or its hash and
-- grants nothing: it only maps to a signup. Codes go after 90 days; deleting a signup deletes its
-- codes and unlinks its events.

create table public.download_refs (
  -- 16 random bytes as base64url, made by api/download.
  ref text primary key check (ref ~ '^[A-Za-z0-9_-]{22}$'),
  signup_id bigint not null references public.signups (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.download_refs is 'The code each download start appends to the signed URL, and its signup (Decision 39). Rows go after 90 days.';

-- What the signup cascade and the cleanup look for.
create index download_refs_signup_id on public.download_refs (signup_id);
create index download_refs_created_at on public.download_refs (created_at);

-- Browsers never touch this table (Decision 12): RLS on with no policies, and no grants to the
-- public roles. The service role bypasses RLS.
alter table public.download_refs enable row level security;
revoke all on table public.download_refs from anon, authenticated;

-- Stores a code against the signup that owns the download token. An unknown token stores nothing.
create function public.save_download_ref(p_ref text, p_token_hash text)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.download_refs (ref, signup_id)
  select p_ref, signup_id from public.download_tokens where token_hash = p_token_hash;
$$;

revoke execute on function public.save_download_ref(text, text) from public, anon, authenticated;
grant execute on function public.save_download_ref(text, text) to service_role;

-- An event links to its signup only through a code; deleting the signup leaves an anonymous count.
alter table public.telemetry_events add column signup_id bigint references public.signups (id) on delete set null;
create index telemetry_events_signup_id on public.telemetry_events (signup_id);

-- One save_telemetry_event: the four-argument version goes, and the new one takes an optional code.
drop function public.save_telemetry_event(uuid, text, text, text);

-- Saves an event and answers true, or false when this install ID already sent it. A known code under
-- 90 days old links the event to its signup; any other code saves it unlinked.
create function public.save_telemetry_event(
  p_install_id uuid,
  p_event text,
  p_app_version text,
  p_macos_version text,
  p_download_ref text default null
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  linked bigint;
begin
  select signup_id into linked
  from public.download_refs
  where ref = p_download_ref and created_at > now() - interval '90 days';

  insert into public.telemetry_events (install_id, event, app_version, macos_version, signup_id)
  values (p_install_id, p_event, p_app_version, p_macos_version, linked)
  on conflict (install_id, event) do nothing;
  return found;
end;
$$;

revoke execute on function public.save_telemetry_event(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.save_telemetry_event(uuid, text, text, text, text) to service_role;

-- Deletes codes made more than 90 days ago and returns how many it deleted.
create function public.delete_old_download_refs()
returns integer
language sql
security invoker
set search_path = ''
as $$
  with gone as (
    delete from public.download_refs where created_at < now() - interval '90 days' returning 1
  )
  select count(*)::integer from gone;
$$;

revoke execute on function public.delete_old_download_refs() from public, anon, authenticated;
grant execute on function public.delete_old_download_refs() to service_role;

-- The scheduled job: daily at 04:47 UTC, with Supabase's pg_cron.
select cron.schedule('delete-old-download-refs', '47 4 * * *', 'select public.delete_old_download_refs()');
