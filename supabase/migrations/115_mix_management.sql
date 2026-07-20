-- Mix Management: archive, scheduled publishing, published_at tracking
-- Adds columns for soft-delete (archive), scheduled release, and publish timestamp.

alter table public.mixes add column if not exists archived boolean not null default false;
alter table public.mixes add column if not exists scheduled_at timestamptz;
alter table public.mixes add column if not exists published_at timestamptz;

-- Update RLS: archived mixes excluded from public reads
drop policy if exists "Published mixes are publicly readable (excl. blocked)" on public.mixes;

create policy "Published mixes are publicly readable (excl. blocked)"
  on public.mixes for select
  using (
    (published = true and archived = false or dj_id = auth.uid())
    and not exists (
      select 1 from public.user_blocks
      where blocker_id = dj_id and blocked_id = auth.uid()
    )
  );

-- Index for cron job: find scheduled mixes that are ready to publish
create index if not exists idx_mixes_scheduled
  on public.mixes (scheduled_at)
  where scheduled_at is not null and published = false and archived = false;
