-- Migration 039: Moderation columns, notification type expansion, upload pipeline
--
-- 1. Adds moderation_status/moderation_reason columns to content tables
--    (the Lua moderation agent writes to these; they must exist at the schema
--    level to avoid SQL errors).
-- 2. Expands notifications type check to include buzz_like, mention, and repost.
-- 3. Adds buzz_id column to notifications for buzz-related event linking.
-- 4. Adds upload processing pipeline fields to mixes.

-- ===== 1. Moderation columns on content tables =====

do $$
declare
  tbl text;
begin
  foreach tbl in array array['mixes', 'comments', 'buzzes', 'profiles'] loop
    execute format('
      alter table public.%I
        add column if not exists moderation_status text
          default ''pending''
          check (moderation_status in (''pending'', ''passed'', ''flagged'', ''hidden'', ''banned''));
    ', tbl);
    execute format('
      alter table public.%I
        add column if not exists moderation_reason text;
    ', tbl);
  end loop;
end;
$$;

-- ===== 2. Notification type check =====

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
    check (type = any (array[
      'like'::text,
      'follow'::text,
      'comment'::text,
      'reply'::text,
      'mix_upload'::text,
      'mention'::text,
      'buzz_like'::text,
      'repost'::text
    ]));

-- ===== 3. buzz_id column on notifications =====

alter table public.notifications
  add column if not exists buzz_id uuid references public.buzzes(id) on delete cascade;

-- ===== 4. Upload pipeline fields =====

alter table public.mixes
  add column if not exists upload_status text
    default 'uploaded'
    check (upload_status in ('uploaded', 'processing', 'ready', 'error')),
  add column if not exists processing_errors jsonb default '[]'::jsonb,
  add column if not exists processing_started_at timestamptz,
  add column if not exists processing_completed_at timestamptz;

-- Index for processing queue queries
create index if not exists idx_mixes_upload_status
  on public.mixes (upload_status, created_at)
  where upload_status != 'ready';
