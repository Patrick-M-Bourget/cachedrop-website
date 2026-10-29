-- The rate limit keeps an IP hash a day at most (Decision 12). hit_rate_limit only prunes on the
-- next hit, so a quiet spell could keep a hash longer; this daily job deletes every window that
-- started more than a day ago, like the token cleanup (#9).

-- Deletes windows that started more than a day ago and returns how many it deleted.
create function public.delete_old_rate_limits()
returns integer
language sql
security invoker
set search_path = ''
as $$
  with gone as (
    delete from public.rate_limits where window_start < now() - interval '1 day' returning 1
  )
  select count(*)::integer from gone;
$$;

revoke execute on function public.delete_old_rate_limits() from public, anon, authenticated;
grant execute on function public.delete_old_rate_limits() to service_role;

-- The scheduled job: daily at 04:27 UTC, with Supabase's pg_cron.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('delete-old-rate-limits', '27 4 * * *', 'select public.delete_old_rate_limits()');
