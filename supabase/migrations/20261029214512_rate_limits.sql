-- Per-IP rate limit on the download form and the feedback form (Decision 12). api/signup and
-- api/feedback count each submission that passed the Turnstile check here, under a keyed hash of
-- the IP (src/server/bot-check.ts), never the IP itself. Windows are fixed and line up with the
-- clock, so a blocked place waits for the rest of its window. Rows older than a day are deleted
-- on the next hit, so a hash lives a day at most.

create table public.rate_limits (
  bucket text not null check (bucket in ('signup', 'feedback')),
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  window_start timestamptz not null,
  hits integer not null default 1 check (hits > 0),
  primary key (bucket, ip_hash, window_start)
);

comment on table public.rate_limits is 'Form submissions per keyed IP hash per window (Decision 12). Never holds an IP; rows go after a day.';

-- What the cleanup looks for.
create index rate_limits_window_start on public.rate_limits (window_start);

-- Browsers never touch this table (Decision 12): RLS on with no policies, and no grants to the
-- public roles. The service role bypasses RLS.
alter table public.rate_limits enable row level security;
revoke all on table public.rate_limits from anon, authenticated;

-- Counts one hit and answers 0 when it is within p_limit for the current p_window_seconds window,
-- or the seconds until that window ends when it is over.
create function public.hit_rate_limit(p_bucket text, p_ip_hash text, p_limit integer, p_window_seconds integer)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_start timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  if p_limit < 1 or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'hit_rate_limit: limit must be positive and the window between 1 second and a day';
  end if;
  delete from public.rate_limits where window_start < now() - interval '1 day';
  insert into public.rate_limits as r (bucket, ip_hash, window_start)
  values (p_bucket, p_ip_hash, v_start)
  on conflict (bucket, ip_hash, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;
  if v_hits <= p_limit then
    return 0;
  end if;
  return greatest(1, ceil(extract(epoch from (v_start + make_interval(secs => p_window_seconds) - now())))::integer);
end;
$$;

revoke execute on function public.hit_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, text, integer, integer) to service_role;
