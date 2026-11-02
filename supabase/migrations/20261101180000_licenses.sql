-- Licenses sold through Stripe (Decision 40; mac-cleaner Decisions 135, 136). The license Edge
-- Function (supabase/functions/license) saves one row per paid Checkout Session when Stripe's
-- webhook arrives, signs the key from the row, and emails it. The key itself is never stored: the
-- same row always signs the same key (Ed25519 is deterministic), so "resend my key" re-signs it.

create table public.licenses (
  -- The license ID in the key, and what the app's revocation list holds. Random, made by the function.
  id uuid primary key,
  edition text not null check (edition in ('standard')),
  macs smallint not null check (macs between 1 and 255),
  -- The key's issue date: whole UTC days since 1970-01-01, unsigned 16-bit.
  issue_day integer not null check (issue_day between 0 and 65535),
  -- One license per Checkout Session, so a replayed webhook issues nothing new.
  stripe_session_id text not null unique check (stripe_session_id ~ '^cs_(test|live)_[A-Za-z0-9]+$'),
  -- Null when the Payment Link made no Stripe customer.
  stripe_customer_id text check (stripe_customer_id ~ '^cus_[A-Za-z0-9]+$'),
  email text not null check (email = lower(email) and length(email) between 3 and 254),
  -- The language the key email goes out in.
  lang text not null check (lang in ('en', 'fr')),
  created_at timestamptz not null default now(),
  -- When Resend accepted the key email; null until then, so Stripe's retry sends it again.
  emailed_at timestamptz
);

comment on table public.licenses is 'One license per paid Stripe Checkout Session (Decision 40). The key is re-signed from the row, never stored.';

-- What "resend my key" looks up.
create index licenses_email on public.licenses (email);

-- Browsers never touch this table (Decision 12): RLS on with no policies, and no grants to the
-- public roles. The service role bypasses RLS.
alter table public.licenses enable row level security;
revoke all on table public.licenses from anon, authenticated;

-- Saves the license for a Checkout Session, or finds the one already saved for it, and returns
-- that row. A replay gets the first row back, with its own ID and issue day, so the key it signs
-- is the same. If another delivery of the same session is inserting at this moment, no row may
-- come back; the function then answers an error and Stripe retries.
create function public.issue_license(
  p_id uuid,
  p_stripe_session_id text,
  p_stripe_customer_id text,
  p_email text,
  p_lang text,
  p_edition text,
  p_macs integer,
  p_issue_day integer
)
returns table (id uuid, edition text, macs smallint, issue_day integer, email text, lang text, emailed_at timestamptz)
language sql
security invoker
set search_path = ''
as $$
  with saved as (
    insert into public.licenses (id, stripe_session_id, stripe_customer_id, email, lang, edition, macs, issue_day)
    values (p_id, p_stripe_session_id, p_stripe_customer_id, p_email, p_lang, p_edition, p_macs, p_issue_day)
    on conflict (stripe_session_id) do nothing
    returning licenses.id, licenses.edition, licenses.macs, licenses.issue_day, licenses.email, licenses.lang, licenses.emailed_at
  )
  select * from saved
  union all
  select l.id, l.edition, l.macs, l.issue_day, l.email, l.lang, l.emailed_at
  from public.licenses l
  where l.stripe_session_id = p_stripe_session_id and not exists (select 1 from saved);
$$;

revoke execute on function public.issue_license(uuid, text, text, text, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.issue_license(uuid, text, text, text, text, text, integer, integer) to service_role;

-- Records that Resend accepted the key email. Answers true when the license exists.
create function public.mark_license_emailed(p_id uuid)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  with marked as (
    update public.licenses set emailed_at = coalesce(emailed_at, now()) where id = p_id returning 1
  )
  select count(*) > 0 from marked;
$$;

revoke execute on function public.mark_license_emailed(uuid) from public, anon, authenticated;
grant execute on function public.mark_license_emailed(uuid) to service_role;

-- The licenses bought with an email address, oldest first, for "resend my key".
create function public.licenses_for_email(p_email text)
returns table (id uuid, edition text, macs smallint, issue_day integer, email text, lang text, emailed_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select l.id, l.edition, l.macs, l.issue_day, l.email, l.lang, l.emailed_at
  from public.licenses l
  where l.email = lower(p_email)
  order by l.created_at;
$$;

revoke execute on function public.licenses_for_email(text) from public, anon, authenticated;
grant execute on function public.licenses_for_email(text) to service_role;

-- "Resend my key" shares the per-place rate limit (Decision 12) under its own bucket.
alter table public.rate_limits drop constraint rate_limits_bucket_check;
alter table public.rate_limits add constraint rate_limits_bucket_check check (bucket in ('signup', 'feedback', 'telemetry', 'license'));
comment on table public.rate_limits is 'Requests per keyed IP hash per window: the forms after Turnstile (download, feedback, resend my key), and the app''s setup progress (Decisions 12, 38, 40). Never holds an IP; rows go after a day.';
