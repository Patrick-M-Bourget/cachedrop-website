-- Email gate (Decisions 1, 2): a signup per email, download tokens that work for 7 days, and a
-- count of download starts per release. The Vercel functions in api/ are the only callers.
-- Tokens are stored as SHA-256 hashes; the token itself exists only in the emailed link.

create table public.signups (
  id bigint generated always as identity primary key,
  email text not null unique check (email = lower(email) and char_length(email) between 3 and 254),
  -- The optional "What's filling your Mac?" answer.
  filling text check (filling in ('development', 'video-photo', 'music-audio', 'other')),
  created_at timestamptz not null default now()
);

comment on table public.signups is 'One row per email that asked for the download (Decision 1).';

create table public.download_tokens (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  signup_id bigint not null references public.signups (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);

create index download_tokens_signup_id on public.download_tokens (signup_id);

comment on table public.download_tokens is 'SHA-256 of each emailed download token; a token works until expires_at (Decision 2).';

-- Download starts per release: each time a token page starts the download or its retry link is used.
alter table public.releases add column download_starts bigint not null default 0 check (download_starts >= 0);

-- Browsers never touch these tables (Decision 12): RLS on with no policies, and no grants to the
-- public roles. The service role bypasses RLS.
alter table public.signups enable row level security;
alter table public.download_tokens enable row level security;
revoke all on table public.signups from anon, authenticated;
revoke all on table public.download_tokens from anon, authenticated;

-- Saves the signup (or finds the existing one for this email) and records a new token for it.
create function public.request_download(p_email text, p_filling text, p_token_hash text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  signup_id bigint;
begin
  insert into public.signups (email, filling)
  values (p_email, p_filling)
  on conflict (email) do nothing
  returning id into signup_id;

  if signup_id is null then
    select id into signup_id from public.signups where email = p_email;
  end if;

  insert into public.download_tokens (token_hash, signup_id) values (p_token_hash, signup_id);
end;
$$;

-- Looks up a token and the latest release. status is 'ok', 'unknown', 'expired' or 'no_release';
-- version and filename are set only for 'ok'. With p_count, an 'ok' lookup counts a download start.
create function public.download_for_token(p_token_hash text, p_count boolean)
returns table (status text, version text, filename text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  token_expires timestamptz;
  latest public.releases;
begin
  select expires_at into token_expires from public.download_tokens where token_hash = p_token_hash;
  if not found then
    return query select 'unknown'::text, null::text, null::text;
    return;
  end if;
  if token_expires <= now() then
    return query select 'expired'::text, null::text, null::text;
    return;
  end if;

  select * into latest from public.releases where is_latest;
  if not found then
    return query select 'no_release'::text, null::text, null::text;
    return;
  end if;

  if p_count then
    update public.releases set download_starts = download_starts + 1 where id = latest.id;
  end if;

  return query select 'ok'::text, latest.version, latest.filename;
end;
$$;

revoke execute on function public.request_download(text, text, text) from public, anon, authenticated;
revoke execute on function public.download_for_token(text, boolean) from public, anon, authenticated;
grant execute on function public.request_download(text, text, text) to service_role;
grant execute on function public.download_for_token(text, boolean) to service_role;
