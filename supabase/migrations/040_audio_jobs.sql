-- Migration 040: Audio Jobs Table and Processing Pipeline
--
-- Adds audio job tracking table and updates mixes table with waveform support.
-- Enables proper audio processing workflow with job queuing and status tracking.

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

-- ── 2. Update Mixes Table for Waveform Support ───────────────────────────────

-- Add waveform URL and duration fields to mixes table
alter table public.mixes
  add column if not exists waveform_url text,
  add column if not exists waveform_data jsonb,
  add column if not exists duration_seconds real,
  add column if not exists audio_metadata jsonb default '{}'::jsonb;

-- Index for waveform URL lookup
create index if not exists idx_mixes_waveform_url
  on public.mixes (waveform_url)
  where waveform_url is not null;

-- ── 3. Audio Processing Functions ──────────────────────────────────────────

-- Function to enqueue an audio processing job
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
  -- Validate job type
  if not p_job_type in ('waveform', 'metadata', 'bpm_key_mood', 'tracklist') then
    raise exception 'Invalid job type: %', p_job_type;
  end if;

  -- Check if job already exists for this mix and type
  select id into v_job_id
  from audio_jobs
  where mix_id = p_mix_id and job_type = p_job_type and status in ('pending', 'processing')
  limit 1;

  if v_job_id is not null then
    return v_job_id;
  end if;

  -- Create new job
  insert into audio_jobs (mix_id, job_type, max_retries)
  values (p_mix_id, p_job_type, p_max_retries)
  returning id into v_job_id;

  return v_job_id;
end;
$$;

-- Function to mark job as processing
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

-- Function to mark job as complete
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
  -- Get job details
  select mix_id, job_type into v_mix_id, v_job_type
  from audio_jobs
  where id = p_job_id;

  -- Update job status
  update audio_jobs
  set status = 'complete',
      result = p_result,
      completed_at = now(),
      updated_at = now()
  where id = p_job_id;

  -- Update mix record based on job type
  if v_job_type = 'waveform' then
    update public.mixes
    set waveform_url = p_result->>'waveform_url',
        waveform_data = p_result->'waveform_data',
        duration_seconds = (p_result->>'duration_seconds')::real,
        audio_metadata = p_result->'audio_metadata',
        upload_status = 'ready',
        processing_completed_at = now()
    where id = v_mix_id;
  elsif v_job_type = 'metadata' then
    update public.mixes
    set duration_seconds = (p_result->>'duration_seconds')::real,
        audio_metadata = p_result->'audio_metadata',
        upload_status = 'ready',
        processing_completed_at = now()
    where id = v_mix_id;
  end if;

  -- If all jobs for this mix are complete, ensure upload_status is ready
  update public.mixes
  set upload_status = 'ready',
      processing_completed_at = now()
  where id = v_mix_id
    and upload_status = 'processing'
    and not exists (
      select 1 from audio_jobs
      where mix_id = v_mix_id
      and status in ('pending', 'processing')
    );
end;
$$;

-- Function to mark job as failed
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
  -- Get current retry count and max retries
  select retry_count, max_retries into v_retry_count, v_max_retries
  from audio_jobs
  where id = p_job_id;

  if p_should_retry and v_retry_count < v_max_retries then
    -- Retry the job
    update audio_jobs
    set status = 'pending',
        retry_count = retry_count + 1,
        error_message = p_error_message,
        updated_at = now()
    where id = p_job_id;
  else
    -- Mark as failed
    update audio_jobs
    set status = 'failed',
        error_message = p_error_message,
        completed_at = now(),
        updated_at = now()
    where id = p_job_id;

    -- Update mix status to error if this was the last attempt
    if v_retry_count >= v_max_retries then
      update public.mixes
      set upload_status = 'error',
          processing_errors = coalesce(processing_errors, '[]'::jsonb) || jsonb_build_array(
            jsonb_build_object(
              'job_type', (select job_type from audio_jobs where id = p_job_id),
              'error', p_error_message,
              'timestamp', now(),
              'retry_count', v_retry_count
            )
          ),
          processing_completed_at = now()
      where id = (select mix_id from audio_jobs where id = p_job_id);
    end if;
  end if;
end;
$$;

-- ── 4. Update Mixes Trigger for Automatic Job Enqueuing ──────────────────────

-- Trigger to automatically enqueue waveform job when upload_status becomes 'processing'
create or replace function trigger_waveform_job()
returns trigger
language plpgsql
as $$
begin
  if NEW.upload_status = 'processing' and OLD.upload_status = 'uploaded' then
    -- Enqueue waveform job
    perform enqueue_audio_job(NEW.id, 'waveform');
  end if;
  return NEW;
end;
$$;

create trigger trg_mixes_upload_processing
  after update on public.mixes
  for each row
  execute function trigger_waveform_job();

-- ── 5. Cleanup Function ─────────────────────────────────────────────────────

-- Function to clean up old completed jobs
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