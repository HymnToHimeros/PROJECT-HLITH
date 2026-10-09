-- PROJECT-HLITH · 0004 · profile showcase (Account → Profile)
-- Same rules as 0001: this migration only adds. public.profiles keeps row-level
-- security from 0001 (read/create/change your own row, no delete policy).

-- ── Profile fields ─────────────────────────────────────────────────
-- All nullable: an empty profile shows your initial, a default banner and no bio.
-- avatar_path / banner_path are paths inside the `avatars` bucket (<user id>/avatar.jpg).
-- showcase = { "pinned": { "<game id>": ["<character id>", …] }, "hidden_cards": ["pulls", …] }.
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists avatar_path text;
alter table public.profiles add column if not exists banner_path text;
alter table public.profiles add column if not exists showcase jsonb;

-- Limits match the app (name 40, bio 200 characters); pictures must sit in your own folder.
alter table public.profiles add constraint profiles_display_name_length check (display_name is null or char_length(display_name) <= 40) not valid;
alter table public.profiles add constraint profiles_bio_length check (bio is null or char_length(bio) <= 200);
alter table public.profiles add constraint profiles_avatar_own_folder check (avatar_path is null or split_part(avatar_path, '/', 1) = user_id::text);
alter table public.profiles add constraint profiles_banner_own_folder check (banner_path is null or split_part(banner_path, '/', 1) = user_id::text);
alter table public.profiles add constraint profiles_showcase_object check (showcase is null or jsonb_typeof(showcase) = 'object');

-- ── Picture storage ────────────────────────────────────────────────
-- The bucket is also declared in supabase/config.toml. This insert makes sure it exists
-- on the live project either way; it never changes an existing bucket.
-- Public read: profile pictures are shown with plain links (no sign-in needed to load them).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

-- Writes only into your own folder: the first folder of the path must be your user id.
-- Upload with "replace" (upsert) needs insert + select + update (Supabase storage docs).
-- No delete policy: an old picture is replaced in place, never removed by the app.
create policy "avatars: upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub'));
create policy "avatars: see own files" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub'));
create policy "avatars: replace own files" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub'))
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub'));
