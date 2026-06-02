-- Mix Hive v4.1 - Media Processing Status Update
-- Run after 040_buzz_triggers_and_fix.sql

-- Update upload_status enum to use 'failed' instead of 'error'
-- Rename processing_completed_at to processed_at for clarity

begin;

-- First, update any existing 'error' status to 'failed' for consistency
update public.mixes
set upload_status = 'failed'
where upload_status = 'error';

-- Drop the old check constraint and add new one
alter table public.mixes
  drop constraint if exists mixes_upload_status_check,
  add constraint mixes_upload_status_check
    check (upload_status in ('uploaded', 'processing', 'ready', 'failed'));

-- Rename processing_completed_at to processed_at
alter table public.mixes
  rename column processing_completed_at to processed_at;

commit;
