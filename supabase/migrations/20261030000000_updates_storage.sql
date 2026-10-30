-- Immutable full-DMG updater storage is separate from the email-gated private releases bucket.
-- No anon/authenticated write policies: only the owner/service role can stage artifacts.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('updates', 'updates', true, 52428800, array['application/x-apple-diskimage'])
on conflict (id) do nothing;
