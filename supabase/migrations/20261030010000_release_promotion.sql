-- #518: serialize website/latest and appcast promotion, preserving immutable release identities.
alter table public.releases add column build bigint check (build > 0);
alter table public.releases add column artifact_identity jsonb;
create unique index releases_unique_build on public.releases (build) where build is not null;

create table public.release_feeds (
  singleton boolean primary key default true check (singleton),
  version text not null references public.releases(version),
  appcast_xml text not null check (octet_length(appcast_xml) between 1 and 2097152),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$')
);
alter table public.release_feeds enable row level security;
revoke all on public.release_feeds from anon, authenticated;

create function public.protect_release_identity() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.artifact_identity is not null and
     (new.version, new.filename, new.size_bytes, new.sha256, new.build, new.artifact_identity)
     is distinct from (old.version, old.filename, old.size_bytes, old.sha256, old.build, old.artifact_identity) then
    raise exception 'published release identity is immutable';
  end if;
  return new;
end;
$$;
create trigger releases_immutable_identity before update on public.releases
for each row execute function public.protect_release_identity();

create function public.promote_staged_release(p_identity jsonb) returns public.releases
language plpgsql security invoker set search_path = '' as $$
declare
  v text := p_identity->>'version';
  b bigint;
  existing public.releases;
  latest public.releases;
begin
  perform pg_advisory_xact_lock(518);
  if v is null or v !~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'
    or coalesce(p_identity->>'build', '') !~ '^[1-9][0-9]*$'
    or p_identity->>'filename' is distinct from 'CacheDrop-' || v || '.dmg'
    or coalesce(p_identity->>'sha256', '') !~ '^[a-f0-9]{64}$'
    or coalesce(p_identity->>'releaseNotesSHA256', '') !~ '^[a-f0-9]{64}$'
    or p_identity->>'bundleID' is distinct from 'com.patrickbourget.CacheDrop'
    or p_identity->>'teamID' is distinct from '8F5K2ZRP5T' then
    raise exception 'invalid stable release identity';
  end if;
  b := (p_identity->>'build')::bigint;
  select * into existing from public.releases where version = v for update;
  if found then
    if existing.is_latest and existing.artifact_identity = p_identity then return existing; end if;
    raise exception 'version already exists with a different identity or is no longer latest';
  end if;
  select * into latest from public.releases where is_latest for update;
  if latest.version is not null and string_to_array(v, '.')::int[] <= string_to_array(latest.version, '.')::int[] then
    raise exception 'marketing version must increase';
  end if;
  if b <= coalesce((select max(build) from public.releases), 0) then raise exception 'app build must increase'; end if;
  update public.releases set is_latest = false where is_latest;
  insert into public.releases(version, filename, size_bytes, sha256, is_latest, build, artifact_identity)
  values(v, p_identity->>'filename', (p_identity->>'length')::bigint, p_identity->>'sha256', true, b, p_identity)
  returning * into existing;
  return existing;
end;
$$;

create function public.promote_release_feed(p_identity jsonb, p_appcast_xml text, p_sha256 text) returns void
language plpgsql security invoker set search_path = '' as $$
declare latest public.releases; prior public.release_feeds;
begin
  perform pg_advisory_xact_lock(518);
  select * into latest from public.releases where is_latest for update;
  if latest.artifact_identity is distinct from p_identity then raise exception 'website latest must match before feed promotion'; end if;
  if p_sha256 is distinct from encode(sha256(convert_to(p_appcast_xml, 'UTF8')), 'hex') then raise exception 'feed hash mismatch'; end if;
  select * into prior from public.release_feeds where singleton for update;
  if found and prior.version = latest.version then
    if prior.sha256 = p_sha256 and prior.appcast_xml = p_appcast_xml then return; end if;
    raise exception 'already published feed for this version cannot be replaced';
  end if;
  insert into public.release_feeds(singleton, version, appcast_xml, sha256)
  values(true, latest.version, p_appcast_xml, p_sha256)
  on conflict(singleton) do update set version = excluded.version, appcast_xml = excluded.appcast_xml, sha256 = excluded.sha256;
end;
$$;

-- Legacy manual publication remains usable before Sparkle publication starts. Thereafter it
-- cannot bypass staging, increasing build numbers, or race the promotion lock.
create or replace function public.publish_release(p_version text, p_filename text, p_size_bytes bigint, p_sha256 text)
returns public.releases language plpgsql security invoker set search_path = '' as $$
declare current_latest text; published public.releases;
begin
  perform pg_advisory_xact_lock(518);
  if exists(select 1 from public.releases where artifact_identity is not null) then
    raise exception 'use stage-release.sh and promote-release.sh for signed Sparkle releases';
  end if;
  select version into current_latest from public.releases where is_latest for update;
  if current_latest is not null and string_to_array(p_version, '.')::int[] <= string_to_array(current_latest, '.')::int[] then
    raise exception 'version must increase';
  end if;
  update public.releases set is_latest = false where is_latest;
  insert into public.releases(version, filename, size_bytes, sha256, is_latest)
  values(p_version, p_filename, p_size_bytes, p_sha256, true) returning * into published;
  return published;
end;
$$;

revoke execute on function public.promote_staged_release(jsonb) from public, anon, authenticated;
revoke execute on function public.promote_release_feed(jsonb, text, text) from public, anon, authenticated;
grant execute on function public.promote_staged_release(jsonb) to service_role;
grant execute on function public.promote_release_feed(jsonb, text, text) to service_role;
