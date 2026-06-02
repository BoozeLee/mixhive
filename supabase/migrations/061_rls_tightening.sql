-- Migration 061: RLS tightening — mix_scores, reports, search_history, genres
--
-- Four tables were created before the RLS policy pattern was established and
-- have no security policies. Each section is wrapped in a conditional DO block
-- so the migration is safe even if a table does not exist in this environment.
--
-- Resolves: Phase 2 security posture — RLS on remaining unprotected tables

begin;

-- =====================================================================
-- mix_scores (may not exist if feed algorithm was not applied)
-- =====================================================================
do $mix$ begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'mix_scores'
  ) then
    alter table public.mix_scores enable row level security;
    drop policy if exists "mix_scores_public_read" on public.mix_scores;
    create policy "mix_scores_public_read"
      on public.mix_scores for select
      using (true);
    drop policy if exists "mix_scores_service_all" on public.mix_scores;
    create policy "mix_scores_service_all"
      on public.mix_scores for all
      using  (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $mix$;

-- =====================================================================
-- reports (may not exist — created via manual schema before migrations)
-- =====================================================================
do $rpt$ begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'reports'
  ) then
    alter table public.reports enable row level security;
    drop policy if exists "reports_owner_read" on public.reports;
    create policy "reports_owner_read"
      on public.reports for select
      using (auth.uid() = reporter_id);
    drop policy if exists "reports_owner_insert" on public.reports;
    create policy "reports_owner_insert"
      on public.reports for insert
      with check (auth.uid() = reporter_id);
    drop policy if exists "reports_service_all" on public.reports;
    create policy "reports_service_all"
      on public.reports for all
      using  (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $rpt$;

-- =====================================================================
-- search_history (may not exist — created via manual schema before migrations)
-- =====================================================================
do $sh$ begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'search_history'
  ) then
    alter table public.search_history enable row level security;
    drop policy if exists "search_history_owner_all" on public.search_history;
    create policy "search_history_owner_all"
      on public.search_history for all
      using  (auth.uid() = user_id)
      with check (auth.uid() = user_id);
    drop policy if exists "search_history_service_all" on public.search_history;
    create policy "search_history_service_all"
      on public.search_history for all
      using  (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $sh$;

-- =====================================================================
-- genres (public taxonomy — always exists from migration 001)
-- =====================================================================
alter table public.genres enable row level security;

drop policy if exists "genres_public_read" on public.genres;
create policy "genres_public_read"
  on public.genres for select
  using (true);

drop policy if exists "genres_service_write" on public.genres;
create policy "genres_service_write"
  on public.genres for all
  using  (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Resolves: Phase 2 security posture — RLS on remaining unprotected tables
commit;
