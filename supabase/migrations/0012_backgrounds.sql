-- PROJECT-HLITH · 0012 · your own background pictures (T52d, Customise → Background picture)
-- Same rules as 0001: this migration only adds.
--
-- A private bucket: every file sits in its owner's own folder (<user id>/…) and only that
-- account can read, add or replace it. No plain links, no one else's pictures, not even the
-- owner's. Which picture goes where (a theme, a page, every page) is in your settings.
-- No delete policy (same as avatars): a picture is replaced in place; "Remove" only stops
-- showing it.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('backgrounds', 'backgrounds', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "backgrounds: see own files" on storage.objects for select to authenticated
  using (bucket_id = 'backgrounds' and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub'));
create policy "backgrounds: upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'backgrounds' and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub'));
create policy "backgrounds: replace own files" on storage.objects for update to authenticated
  using (bucket_id = 'backgrounds' and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub'))
  with check (bucket_id = 'backgrounds' and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub'));
