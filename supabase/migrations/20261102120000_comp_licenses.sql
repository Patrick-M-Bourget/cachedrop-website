-- Free licenses the owner gives away (Decision 45). The license function's /comp route saves them
-- with source 'comp', no Stripe IDs and an optional note saying why, then signs and emails the key
-- like a bought one. Revocation and "resend my key" treat them like any other license.

alter table public.licenses
  add column source text not null default 'stripe' check (source in ('stripe', 'comp')),
  add column note text check (note is null or length(note) between 1 and 200);

alter table public.licenses alter column stripe_session_id drop not null;
-- A Stripe license always has its Checkout Session; a free one never has Stripe IDs.
alter table public.licenses add constraint licenses_source_stripe check (
  (source = 'stripe' and stripe_session_id is not null)
  or (source = 'comp' and stripe_session_id is null and stripe_customer_id is null)
);

comment on table public.licenses is 'One license per paid Stripe Checkout Session (Decision 40), or one the owner gave away (Decision 45). The key is re-signed from the row, never stored.';
comment on column public.licenses.note is 'Free licenses only: why it was given, in a few words (Decision 45).';

-- Saves a free license with the ID the owner's script chose, or finds the one already saved with
-- it, so running the script again after a failed email sends the same key instead of a second one.
create function public.comp_license(
  p_id uuid,
  p_email text,
  p_lang text,
  p_note text,
  p_edition text,
  p_macs integer,
  p_issue_day integer
)
returns table (id uuid, edition text, macs smallint, issue_day integer, email text, lang text, emailed_at timestamptz, source text)
language sql
security invoker
set search_path = ''
as $$
  with saved as (
    insert into public.licenses (id, source, note, email, lang, edition, macs, issue_day)
    values (p_id, 'comp', p_note, p_email, p_lang, p_edition, p_macs, p_issue_day)
    on conflict (id) do nothing
    returning licenses.id, licenses.edition, licenses.macs, licenses.issue_day, licenses.email, licenses.lang, licenses.emailed_at, licenses.source
  )
  select * from saved
  union all
  select l.id, l.edition, l.macs, l.issue_day, l.email, l.lang, l.emailed_at, l.source
  from public.licenses l
  where l.id = p_id and l.source = 'comp' and not exists (select 1 from saved);
$$;

revoke execute on function public.comp_license(uuid, text, text, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.comp_license(uuid, text, text, text, text, integer, integer) to service_role;

-- "Resend my key" now says which kind each license is, so a free one comes back in the gift email.
drop function public.licenses_for_email(text);
create function public.licenses_for_email(p_email text)
returns table (id uuid, edition text, macs smallint, issue_day integer, email text, lang text, emailed_at timestamptz, source text)
language sql
stable
security invoker
set search_path = ''
as $$
  select l.id, l.edition, l.macs, l.issue_day, l.email, l.lang, l.emailed_at, l.source
  from public.licenses l
  where l.email = lower(p_email)
  order by l.created_at;
$$;

revoke execute on function public.licenses_for_email(text) from public, anon, authenticated;
grant execute on function public.licenses_for_email(text) to service_role;
