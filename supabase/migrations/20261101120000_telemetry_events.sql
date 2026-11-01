-- Opt-in setup progress from the CacheDrop app (Decision 38; mac-cleaner Decision 127). api/telemetry
-- saves at most one row per install ID and event: first launch, first scan completed, first cleanup
-- completed, with the app and macOS versions. No IP, path, name, size or anything found on a Mac.
-- Rows go after 13 months.

create table public.telemetry_events (
  id bigint generated always as identity primary key,
  -- Random, made by the app when the person opts in; a new one after Reset.
  install_id uuid not null,
  event text not null check (event in ('first_launch', 'first_scan_completed', 'first_cleanup_completed')),
  app_version text not null check (app_version ~ '^[0-9]{1,4}(\.[0-9]{1,4}){1,2}$'),
  macos_version text not null check (macos_version ~ '^[0-9]{1,3}(\.[0-9]{1,3}){0,2}$'),
  received_at timestamptz not null default now(),
  unique (install_id, event)
);

comment on table public.telemetry_events is 'Opt-in setup progress from the app, one row per install ID and event (Decision 38). No IP; rows go after 13 months.';

-- What the cleanup looks for.
create index telemetry_events_received_at on public.telemetry_events (received_at);

-- Browsers never touch this table (Decision 12): RLS on with no policies, and no grants to the
-- public roles. The service role bypasses RLS.
alter table public.telemetry_events enable row level security;
revoke all on table public.telemetry_events from anon, authenticated;

-- Saves an event and answers true, or false when this install ID already sent it.
create function public.save_telemetry_event(p_install_id uuid, p_event text, p_app_version text, p_macos_version text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.telemetry_events (install_id, event, app_version, macos_version)
  values (p_install_id, p_event, p_app_version, p_macos_version)
  on conflict (install_id, event) do nothing;
  return found;
end;
$$;

revoke execute on function public.save_telemetry_event(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.save_telemetry_event(uuid, text, text, text) to service_role;

-- The app's requests share the per-place rate limit (Decision 12) under their own bucket.
alter table public.rate_limits drop constraint rate_limits_bucket_check;
alter table public.rate_limits add constraint rate_limits_bucket_check check (bucket in ('signup', 'feedback', 'telemetry'));

-- Deletes events received more than 13 months ago and returns how many it deleted.
create function public.delete_old_telemetry_events()
returns integer
language sql
security invoker
set search_path = ''
as $$
  with gone as (
    delete from public.telemetry_events where received_at < now() - interval '13 months' returning 1
  )
  select count(*)::integer from gone;
$$;

revoke execute on function public.delete_old_telemetry_events() from public, anon, authenticated;
grant execute on function public.delete_old_telemetry_events() to service_role;

-- The scheduled job: daily at 04:37 UTC, with Supabase's pg_cron.
select cron.schedule('delete-old-telemetry-events', '37 4 * * *', 'select public.delete_old_telemetry_events()');
