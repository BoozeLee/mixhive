-- Migration 117: Add visibility column to mixes
--
-- Adds a visibility enum-style text column that replaces the boolean
-- published/archived pattern. Values: draft | scheduled | published | unlisted.
-- Also adds scheduled_at and published_at columns (already exist in schema,
-- but we ensure they're present and add an index for cron queries).
--
-- Resolves: Upload Release Flow v1

begin;

-- Add visibility column (nullable initially, backfill then set NOT NULL)
alter table public.mixes
  add column if not exists visibility text
    check (visibility in ('draft', 'scheduled', 'published', 'unlisted'));

-- Backfill existing rows based on published/archived booleans
update public.mixes
  set visibility = case
    when published = true  then 'published'
    when archived = true   then 'unlisted'
    when scheduled_at is not null then 'scheduled'
    else 'draft'
  end
  where visibility is null;

-- Set NOT NULL now that all rows have a value
alter table public.mixes
  alter column visibility set not null,
  alter column visibility set default 'draft';

-- Ensure scheduled_at / published_at exist (may already be present)
-- and add index for the publish-scheduled cron query
alter table public.mixes
  alter column scheduled_at type timestamptz using scheduled_at::timestamptz,
  alter column published_at type timestamptz using published_at::timestamptz;

create index if not exists idx_mixes_scheduled_due
  on public.mixes (scheduled_at)
  where visibility = 'scheduled';

-- Update RLS to allow owners to read their own drafts/scheduled
-- (existing RLS should already handle this, but verify policy covers visibility)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'mixes'
    and policyname = 'Users can read their own unpublished mixes'
  ) then
    create policy "Users can read their own unpublished mixes"
      on public.mixes for select
      using (
        auth.uid() = dj_id
        and visibility in ('draft', 'scheduled')
      );
  end if;
end
$$;

commit;
