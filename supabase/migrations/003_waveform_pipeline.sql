-- Mix Hive v3 - Waveform & Audio Pipeline
-- Run after 002_notification_triggers.sql

-- ===== SCHEMA CHANGES =====

-- Add waveform pipeline columns to mixes
alter table public.mixes
  add column if not exists status text not null default 'ready'
    check (status in ('processing', 'ready', 'error')),
  add column if not exists waveform_url text,
  add column if not exists original_file_path text,
  add column if not exists audio_quality text default 'original';

-- Transcode job queue (for future server-side transcoding)
create table if not exists public.transcode_jobs (
  id uuid primary key default uuid_generate_v4(),
  mix_id uuid not null references public.mixes(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'done', 'error')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_transcode_jobs_status
  on public.transcode_jobs(status);

-- Enable RLS on transcode_jobs
alter table public.transcode_jobs enable row level security;

-- ===== STORAGE BUCKETS =====

-- Waveform data bucket (public JSON files)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('mix-waveforms', 'mix-waveforms', true, 1048576, array['application/json']),
  ('mixes-original', 'mixes-original', false, 314572800, array[
    'audio/mpeg', 'audio/wav', 'audio/flac', 'audio/aac',
    'audio/ogg', 'audio/mp4', 'audio/x-m4a', 'audio/x-wav'
  ])
on conflict (id) do nothing;

-- ===== STORAGE POLICIES =====

-- Allow public read on waveform files
create policy "Waveforms are publicly readable"
  on storage.objects for select
  using (bucket_id = 'mix-waveforms');

-- Allow authenticated users to upload waveforms
create policy "Users can upload waveforms"
  on storage.objects for insert
  with check (
    bucket_id = 'mix-waveforms'
    and auth.role() = 'authenticated'
  );

-- Allow authenticated users to delete their own waveform files
create policy "Users can delete own waveforms"
  on storage.objects for delete
  using (
    bucket_id = 'mix-waveforms'
    and auth.role() = 'authenticated'
  );

-- Mixes-original: only DJs can upload (ownership via RLS)
create policy "DJs can upload to mixes-original"
  on storage.objects for insert
  with check (
    bucket_id = 'mixes-original'
    and auth.role() = 'authenticated'
  );

create policy "DJs can read own mixes-original files"
  on storage.objects for select
  using (
    bucket_id = 'mixes-original'
    and auth.role() = 'authenticated'
  );

-- ===== RLS on transcode_jobs =====

create policy "Users can view own mix transcode jobs"
  on public.transcode_jobs for select
  using (
    mix_id in (
      select id from public.mixes where dj_id = auth.uid()
    )
  );

create policy "System can manage transcode jobs"
  on public.transcode_jobs for all
  using (auth.role() = 'service_role');
