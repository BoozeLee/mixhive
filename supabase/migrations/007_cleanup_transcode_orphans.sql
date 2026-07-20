-- Migration 007: clean up unused transcode pipeline orphans
--
-- Migration 003 introduced infrastructure for server-side audio transcoding
-- (transcode_jobs table, original_file_path column, mixes-original storage
-- bucket) that was never wired up — there is no Edge Function or trigger
-- that uses it, and the client never writes to it.
--
-- This migration removes the unused pieces. The `audio_quality` column on
-- mixes is intentionally retained because it is referenced by feed RPCs
-- (004, 005) and remains useful for future transcoding work; it simply
-- continues to hold its default value of 'original'.
--
-- Resolves: #2

begin;

-- ===== Drop storage policies for mixes-original =====
drop policy if exists "DJs can upload to mixes-original" on storage.objects;
drop policy if exists "DJs can read own mixes-original files" on storage.objects;
drop policy if exists "DJs can delete own mixes-original files" on storage.objects;

-- ===== Drop mixes-original storage bucket =====
-- Delete any leftover objects first (defensive — bucket should be empty).
do $$
begin
  delete from storage.objects where bucket_id = 'mixes-original';
exception when others then
  -- Newer Supabase storage forbids direct DML on storage.*; the
  -- bucket teardown is best-effort cleanup, not schema.
  raise notice 'skipping storage cleanup: %', sqlerrm;
end $$;
do $$
begin
  delete from storage.buckets where id = 'mixes-original';
exception when others then
  -- Newer Supabase storage forbids direct DML on storage.*; the
  -- bucket teardown is best-effort cleanup, not schema.
  raise notice 'skipping storage cleanup: %', sqlerrm;
end $$;

-- ===== Drop transcode_jobs table (RLS policies cascade) =====
drop table if exists public.transcode_jobs cascade;

-- ===== Drop unused column =====
alter table public.mixes
  drop column if exists original_file_path;

commit;
