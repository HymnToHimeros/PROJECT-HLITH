-- Owner-only themes (T47): a private picture store that only owners can read or write.
--
-- The themes themselves (their names, colours, drawn scenes and the owner's own pictures)
-- are never in the public repo or the public app bundle. They live here, in a private
-- bucket, as a manifest (manifest.json) plus the files it names. The app downloads them at
-- run time only after the server says the signed-in account is an owner (public.is_owner()),
-- so other accounts never receive any of it, not even the theme names.
--
-- Not public: every read needs a signed-in owner (no plain links). Writes are owner-only too.
-- No delete policy (same as avatars): files are replaced in place, never removed by the app.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('owner-themes', 'owner-themes', false, 10485760, array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml', 'application/json'])
on conflict (id) do nothing;

create policy "owner-themes: owners read" on storage.objects for select to authenticated
  using (bucket_id = 'owner-themes' and (select public.is_owner()));
create policy "owner-themes: owners upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'owner-themes' and (select public.is_owner()));
create policy "owner-themes: owners replace" on storage.objects for update to authenticated
  using (bucket_id = 'owner-themes' and (select public.is_owner()))
  with check (bucket_id = 'owner-themes' and (select public.is_owner()));
