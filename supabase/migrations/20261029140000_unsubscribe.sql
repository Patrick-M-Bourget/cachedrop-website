-- Unsubscribe (Decision 4): one link per email that turns off update emails and the news opt-in.
-- An unsubscribed address keeps its signup, so it can still request download links (transactional)
-- and stays unsubscribed when it does. Every email gets its own token, stored as a SHA-256 hash;
-- tokens never expire (CASL: at least 60 days) and go with their signup.

alter table public.signups add column unsubscribed_at timestamptz;

comment on column public.signups.unsubscribed_at is 'Set by the first unsubscribe; no update or news email goes to this address after it (Decision 4).';

create table public.unsubscribe_tokens (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  signup_id bigint not null references public.signups (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index unsubscribe_tokens_signup_id on public.unsubscribe_tokens (signup_id);

comment on table public.unsubscribe_tokens is 'SHA-256 of each emailed unsubscribe token (Decision 4).';

-- Browsers never touch it (Decision 12): RLS on with no policies, no grants to the public roles.
alter table public.unsubscribe_tokens enable row level security;
revoke all on table public.unsubscribe_tokens from anon, authenticated;

-- Records the unsubscribe token for an email about to be sent to an existing signup.
create function public.issue_unsubscribe_token(p_email text, p_token_hash text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.unsubscribe_tokens (token_hash, signup_id)
  select p_token_hash, id from public.signups where email = p_email;
  if not found then
    raise exception 'no signup for this email' using errcode = 'P0002';
  end if;
end;
$$;

-- Unsubscribes the token's address. Returns false for an unknown token. A second call keeps the
-- first time and returns true, so doing it twice is harmless.
create function public.unsubscribe(p_token_hash text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.signups
  set unsubscribed_at = coalesce(unsubscribed_at, now())
  where id = (select signup_id from public.unsubscribe_tokens where token_hash = p_token_hash);
  return found;
end;
$$;

-- The audience for every update and news send: signups that haven't unsubscribed. A news send
-- adds its opt-in filter on top, e.g. `rpc('subscribed_signups').eq(<opt-in column>, true)`.
-- The body is parsed at call time, so columns added to signups later come through.
create function public.subscribed_signups()
returns setof public.signups
language sql
stable
security invoker
set search_path = ''
as $$
  select * from public.signups where unsubscribed_at is null;
$$;

revoke execute on function public.issue_unsubscribe_token(text, text) from public, anon, authenticated;
revoke execute on function public.unsubscribe(text) from public, anon, authenticated;
revoke execute on function public.subscribed_signups() from public, anon, authenticated;
grant execute on function public.issue_unsubscribe_token(text, text) to service_role;
grant execute on function public.unsubscribe(text) to service_role;
grant execute on function public.subscribed_signups() to service_role;
