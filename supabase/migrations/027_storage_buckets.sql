-- Migration 027: Create missing storage buckets
--
-- profile-avatars: user profile pictures (public, 5 MB per file, images only).
-- buzz-media: images / audio / video attached to Buzz posts (public, 50 MB).
-- Both were referenced in code and migration 024 comments but never inserted
-- into storage.buckets, causing every upload to return a 404 "bucket not found".
--
-- Resolves: profile-picture upload bug + buzz media attachment bug

begin;

-- ── profile-avatars ──────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  true,
  5242880,   -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- Anyone can read avatars
drop policy if exists "profile-avatars public read" on storage.objects;
create policy "profile-avatars public read"
  on storage.objects for select
  using (bucket_id = 'profile-avatars');

-- Authenticated users can upload/update/delete their own avatar (path: {user_id}/*)
drop policy if exists "profile-avatars owner write" on storage.objects;
create policy "profile-avatars owner write"
  on storage.objects for insert
  with check (
    bucket_id = 'profile-avatars'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );

drop policy if exists "profile-avatars owner update" on storage.objects;
create policy "profile-avatars owner update"
  on storage.objects for update
  using (
    bucket_id = 'profile-avatars'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );

drop policy if exists "profile-avatars owner delete" on storage.objects;
create policy "profile-avatars owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'profile-avatars'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );

-- ── buzz-media ───────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'buzz-media',
  'buzz-media',
  true,
  52428800,  -- 50 MB
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/mp4',
    'video/mp4', 'video/webm', 'video/ogg'
  ]
)
on conflict (id) do nothing;

-- Anyone can read buzz media
drop policy if exists "buzz-media public read" on storage.objects;
create policy "buzz-media public read"
  on storage.objects for select
  using (bucket_id = 'buzz-media');

-- Authenticated users can upload buzz media (path: {user_id}/*)
drop policy if exists "buzz-media owner write" on storage.objects;
create policy "buzz-media owner write"
  on storage.objects for insert
  with check (
    bucket_id = 'buzz-media'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );

drop policy if exists "buzz-media owner delete" on storage.objects;
create policy "buzz-media owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'buzz-media'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );

commit;
