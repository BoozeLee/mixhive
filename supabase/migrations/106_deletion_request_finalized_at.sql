-- Track when a deletion request is finalized and how many times it failed.
-- Helps distinguish pending grace-window requests from completed ones and
-- surfaces stuck rows that need manual review.
begin;

alter table public.deletion_requests
  add column if not exists finalized_at timestamptz,
  add column if not exists error_count int not null default 0;

commit;
