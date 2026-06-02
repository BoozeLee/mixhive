-- Migration 042: Audio Jobs Table and Processing Pipeline
--
-- Creates audio job tracking table and completes the processing pipeline.
-- Adapted from 040_audio_jobs.sql with processed_at (migration 041 rename)
-- instead of processing_completed_at.
--
-- Resolves: Phase 5 — audio worker job queue is missing from production

begin;

-- ── 1. Audio Jobs Table ──────────────────────────────────────────────────────

create table if not exists audio_jobs (
  id uuid primary key default gen_random_uuid(),
  mix_id uuid not null references public.mixes(id) on delete cascade,
  job_type text not null check (job_type in ('waveform', 'metadata', 'bpm_key_mood', 'tracklist')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'complete', 'failed')),
  retry_count int not null default 0,
  max_retries int not null default 3,
  error_message text,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

-- Indexes for job queue management
create index if not exists idx_audio_jobs_status_created
  on audio_jobs (status, created_at)
  where status in ('pending', 'processing');

create index if not exists idx_audio_jobs_mix_id
  on audio_jobs (mix_id);

create index if not exists idx_audio_jobs_retry_count
  on audio_jobs (retry_count, status)
  where status = 'failed' and retry_count < max_retries;

alter table audio_jobs enable row level security;
-- No client policies — audio jobs are service-role only

-- ── 2. Add Missing Columns to Mixes ──────────────────────────────────────────

alter table public.mixes
  add column if not exists waveform_url text,
  add column if not exists waveform_data jsonb,
  add column if not exists audio_metadata jsonb default '{}'::jsonb;

create index if not exists idx_mixes_waveform_url
  on public.mixes (waveform_url)
  where waveform_url is not null;

-- ── 3. Audio Processing Functions ──────────────────────────────────────────

create or replace function enqueue_audio_job(
  p_mix_id uuid,
  p_job_type text default 'waveform',
  p_max_retries int default 3
)
returns uuid
language plpgsql security definer
as $$
declare
  v_job_id uuid;
begin
  if not p_job_type in ('waveform', 'metadata', 'bpm_key_mood', 'tracklist') then
    raise exception 'Invalid job type: %', p_job_type;
  end if;

  select id into v_job_id
  from audio_jobs
  where mix_id = p_mix_id and job_type = p_job_type and status in ('pending', 'processing')
  limit 1;

  if v_job_id is not null then
    return v_job_id;
  end if;

  insert into audio_jobs (mix_id, job_type, max_retries)
  values (p_mix_id, p_job_type, p_max_retries)
  returning id into v_job_id;

  return v_job_id;
end;
$$;

create or replace function mark_audio_job_processing(p_job_id uuid)
returns void
language plpgsql security definer
as $$
begin
  update audio_jobs
  set status = 'processing',
      started_at = now(),
      updated_at = now()
  where id = p_job_id;
end;
$$;

create or replace function mark_audio_job_complete(
  p_job_id uuid,
  p_result jsonb
)
returns void
language plpgsql security definer
as $$
declare
  v_mix_id uuid;
  v_job_type text;
begin
  select mix_id, job_type into v_mix_id, v_job_type
  from audio_jobs
  where id = p_job_id;

  update audio_jobs
  set status = 'complete',
      result = p_result,
      completed_at = now(),
      updated_at = now()
  where id = p_job_id;

  if v_job_type = 'waveform' then
    update public.mixes
    set waveform_url = p_result->>'waveform_url',
        waveform_data = p_result->'waveform_data',
        duration_seconds = (p_result->>'duration_seconds')::integer,
        audio_metadata = p_result->'audio_metadata',
        upload_status = 'ready',
        processed_at = now()
    where id = v_mix_id;
  elsif v_job_type = 'metadata' then
    update public.mixes
    set duration_seconds = (p_result->>'duration_seconds')::integer,
        audio_metadata = p_result->'audio_metadata',
        upload_status = 'ready',
        processed_at = now()
    where id = v_mix_id;
  end if;

  update public.mixes
  set upload_status = 'ready',
      processed_at = now()
  where id = v_mix_id
    and upload_status = 'processing'
    and not exists (
      select 1 from audio_jobs
      where mix_id = v_mix_id
      and status in ('pending', 'processing')
    );
end;
$$;

create or replace function mark_audio_job_failed(
  p_job_id uuid,
  p_error_message text,
  p_should_retry boolean default true
)
returns void
language plpgsql security definer
as $$
declare
  v_retry_count int;
  v_max_retries int;
begin
  select retry_count, max_retries into v_retry_count, v_max_retries
  from audio_jobs
  where id = p_job_id;

  if p_should_retry and v_retry_count < v_max_retries then
    update audio_jobs
    set status = 'pending',
        retry_count = retry_count + 1,
        error_message = p_error_message,
        updated_at = now()
    where id = p_job_id;
  else
    update audio_jobs
    set status = 'failed',
        error_message = p_error_message,
        completed_at = now(),
        updated_at = now()
    where id = p_job_id;

    if v_retry_count >= v_max_retries then
      update public.mixes
      set upload_status = 'failed',
          processing_errors = coalesce(processing_errors, '[]'::jsonb) || jsonb_build_array(
            jsonb_build_object(
              'job_type', (select job_type from audio_jobs where id = p_job_id),
              'error', p_error_message,
              'timestamp', now(),
              'retry_count', v_retry_count
            )
          ),
          processed_at = now()
      where id = (select mix_id from audio_jobs where id = p_job_id);
    end if;
  end if;
end;
$$;

-- ── 4. Trigger for Automatic Job Enqueuing ──────────────────────────────────────

create or replace function trigger_waveform_job()
returns trigger
language plpgsql
as $$
begin
  if NEW.upload_status = 'processing' and OLD.upload_status = 'uploaded' then
    perform enqueue_audio_job(NEW.id, 'waveform');
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_mixes_upload_processing on public.mixes;
create trigger trg_mixes_upload_processing
  after update on public.mixes
  for each row
  execute function trigger_waveform_job();

-- ── 5. Cleanup Function ─────────────────────────────────────────────────────

create or replace function cleanup_completed_audio_jobs(p_days_to_keep int default 30)
returns int
language plpgsql security definer
as $$
declare
  v_deleted_count int;
begin
  delete from audio_jobs
  where status in ('complete', 'failed')
    and completed_at < now() - interval '1 day' * p_days_to_keep;

  get diagnostics v_deleted_count = row_count;
  return v_deleted_count;
end;
$$;

commit;
