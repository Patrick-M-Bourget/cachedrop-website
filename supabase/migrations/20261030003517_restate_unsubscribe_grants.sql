-- 20261029160000_unsubscribe_marker.sql replaced unsubscribe() without restating its grants. They
-- carried over, but every later migration restates its grants so each file stands on its own; this
-- does the same for that one.
revoke execute on function public.unsubscribe(text) from public, anon, authenticated;
grant execute on function public.unsubscribe(text) to service_role;
