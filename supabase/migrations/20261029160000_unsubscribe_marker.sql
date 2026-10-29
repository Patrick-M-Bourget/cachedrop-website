-- Unsubscribe keeps a do-not-email marker (Decision 32): after an unsubscribe the signup keeps only
-- the email address and unsubscribed_at, so the address is never emailed again. The "What's filling
-- your Mac?" answer goes. A deletion request (privacy@cachedrop.io) removes the row completely.
-- The news opt-in (#9) is cleared here too once both branches are merged.
create or replace function public.unsubscribe(p_token_hash text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.signups
  set unsubscribed_at = coalesce(unsubscribed_at, now()),
      filling = null
  where id = (select signup_id from public.unsubscribe_tokens where token_hash = p_token_hash);
  return found;
end;
$$;
