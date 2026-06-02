-- Migration 053: RLS for mythic_graph_jobs (post-052 hardening)
--
-- During Supabase CLI audit (Phase 3) we discovered:
--   - mythic_graph_jobs exists on remote (from earlier migrations 045/046)
--   - RLS is DISABLED (relrowsecurity = false)
--   - Zero policies
--
-- Jobs are primarily enqueued by SECURITY DEFINER RPCs (end_collab_session,
-- log_performance, etc.) and consumed by the server-side job processor
-- (mythic-graph-processing.ts using service role). However, enabling owner
-- visibility + basic RLS is defense-in-depth and consistent with the rest
-- of the mythic graph tables.
--
-- This migration is intentionally small and safe (no breaking changes).
--
-- Resolves: Phase 3 Supabase CLI RLS gap on job queue table

begin;

-- Enable RLS (idempotent pattern)
alter table public.mythic_graph_jobs enable row level security;

-- Drop any prior experimental policies (harmless if absent)
drop policy if exists "Owners can view their own jobs" on public.mythic_graph_jobs;
drop policy if exists "Owners can insert their own jobs" on public.mythic_graph_jobs;
drop policy if exists "Service role can manage all jobs" on public.mythic_graph_jobs;

-- SELECT: owners see only their jobs (scope->>'user_id' tracks ownership)
-- service role bypasses RLS entirely
create policy "mythic_graph_jobs_select_owner"
  on public.mythic_graph_jobs for select
  using ((scope->>'user_id')::uuid = auth.uid());

-- INSERT: allow authenticated users to enqueue their own jobs directly
-- (most production paths go through SECURITY DEFINER RPCs which set scope)
create policy "mythic_graph_jobs_insert_owner"
  on public.mythic_graph_jobs for insert
  with check ((scope->>'user_id')::uuid = auth.uid());

-- UPDATE/DELETE: intentionally omitted for client role.
-- Jobs are mutated only by the background worker (service role) or
-- via SECURITY DEFINER functions. If a future client-facing "cancel job"
-- RPC is added, it will use a definer function with its own checks.

comment on table public.mythic_graph_jobs is
  'Background job queue for Mythic graph derivation and collab post-processing. RLS added in 053 for owner visibility (scope->>user_id).';

commit;