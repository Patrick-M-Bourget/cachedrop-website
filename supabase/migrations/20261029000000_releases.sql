-- Releases (Decision 15): a private bucket holds the DMGs and `releases` records each version.
-- scripts/publish-dmg.sh uploads CacheDrop-x.y.z.dmg and calls publish_release(); the download
-- function reads the latest row and serves the file through a short-lived signed URL (Decision 2).

-- Private: objects are reachable only with the service key or a signed URL.
-- 50 MB is the Free plan's per-file cap (Decision 13).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('releases', 'releases', false, 52428800, array['application/x-apple-diskimage']);

create table public.releases (
  id bigint generated always as identity primary key,
  version text not null unique check (version ~ '^\d+\.\d+\.\d+$'),
  filename text not null unique check (filename = 'CacheDrop-' || version || '.dmg'),
  size_bytes bigint not null check (size_bytes > 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  is_latest boolean not null default false,
  published_at timestamptz not null default now()
);

comment on table public.releases is 'One row per published DMG. Exactly one row is latest once anything is published.';

-- At most one latest release.
create unique index releases_one_latest on public.releases (is_latest) where is_latest;

-- Browsers never touch this table (Decision 12): RLS on with no policies, and no grants to the
-- public roles. The service role bypasses RLS.
alter table public.releases enable row level security;
revoke all on table public.releases from anon, authenticated;

-- Records a release and makes it the only latest one, in one transaction. Refuses a version that
-- already exists (unique constraint) or one that isn't newer than the current latest.
create function public.publish_release(
  p_version text,
  p_filename text,
  p_size_bytes bigint,
  p_sha256 text
)
returns public.releases
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_latest text;
  published public.releases;
begin
  select version into current_latest
  from public.releases
  where is_latest
  for update;

  if current_latest is not null
     and string_to_array(p_version, '.')::int[] <= string_to_array(current_latest, '.')::int[] then
    raise exception 'version % is not newer than the latest release %', p_version, current_latest
      using errcode = 'P0001';
  end if;

  update public.releases set is_latest = false where is_latest;

  insert into public.releases (version, filename, size_bytes, sha256, is_latest)
  values (p_version, p_filename, p_size_bytes, p_sha256, true)
  returning * into published;

  return published;
end;
$$;

revoke execute on function public.publish_release(text, text, bigint, text) from public, anon, authenticated;
grant execute on function public.publish_release(text, text, bigint, text) to service_role;
