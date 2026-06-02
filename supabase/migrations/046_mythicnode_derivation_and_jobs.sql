-- Migration 046: MythicNode Derivation Triggers + Graph Job Worker Pipeline
--
-- This migration turns the empty tables from 045 into a living graph by:
--   1. Adding a dedicated job queue (`mythic_graph_jobs`) modeled directly on
--      the proven `audio_jobs` pattern (040).
--   2. Providing the core enqueue / mark_* functions.
--   3. Adding high-value derivation triggers that automatically create
--      nodes and edges from existing high-signal events.
--   4. Laying the foundation for heavier background work (similarity,
--      embeddings, quest progress recalculation).
--
-- Design goals:
-- - Keep derivation fast and reliable for the most important events.
-- - Use the same worker infrastructure patterns as audio processing.
-- - Maintain full traceability via source_event on every node/edge.
-- - Stay strictly within the modular monolith + Postgres + background worker model.
--
-- Resolves: Phase 6 graph population layer (see 13-mythicnode-graph-and-agent-api.md)
--
-- Expected follow-ups:
-- - Worker implementation (or extension of job-processor.ts) that handles
--   'derive_edges', 'generate_embeddings', 'recalculate_quest_momentum' etc.
-- - Backfill script for historical data.
-- - Additional triggers as more features (gigs, collabs, etc.) land.

begin;

-- ── 1. Mythic Graph Jobs Table (modeled 1:1 on audio_jobs) ───────────────────

create table if not exists public.mythic_graph_jobs (
  id uuid primary key default gen_random_uuid(),

  -- Flexible scope so one table can serve many derivation job types
  scope jsonb not null default '{}',     -- e.g. {"user_id": "...", "mix_id": "...", "quest_id": "..."}

  job_type text not null check (job_type in (
    'create_mix_node',
    'create_submitted_to_edge',
    'derive_similarity_edges',
    'generate_node_embeddings',
    'recalculate_quest_momentum',
    'backfill_user_graph'
  )),

  status text not null default 'pending'
    check (status in ('pending', 'processing', 'complete', 'failed')),

  retry_count int not null default 0,
  max_retries int not null default 3,

  error_message text,
  result jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

-- Indexes matching the audio_jobs pattern
create index if not exists idx_mythic_graph_jobs_status_created
  on public.mythic_graph_jobs (status, created_at)
  where status in ('pending', 'processing');

create index if not exists idx_mythic_graph_jobs_scope on public.mythic_graph_jobs using gin (scope);
create index if not exists idx_mythic_graph_jobs_type on public.mythic_graph_jobs (job_type);

comment on table public.mythic_graph_jobs is
  'Background job queue for MythicNode derivation and maintenance work. Follows the exact contract established by audio_jobs (040).';

-- ── 2. Core Job Functions (exact parallel to audio_jobs) ─────────────────────

create or replace function public.enqueue_mythic_graph_job(
  p_scope jsonb,
  p_job_type text,
  p_max_retries int default 3
)
returns uuid
language plpgsql security definer
as $$
declare
  v_job_id uuid;
begin
  -- Validate job type
  if p_job_type not in (
    'create_mix_node',
    'create_submitted_to_edge',
    'derive_similarity_edges',
    'generate_node_embeddings',
    'recalculate_quest_momentum',
    'backfill_user_graph'
  ) then
    raise exception 'Invalid mythic graph job type: %', p_job_type;
  end if;

  -- Idempotency: don't create duplicate pending/processing jobs for the same scope + type
  select id into v_job_id
  from public.mythic_graph_jobs
  where scope = p_scope
    and job_type = p_job_type
    and status in ('pending', 'processing')
  limit 1;

  if v_job_id is not null then
    return v_job_id;
  end if;

  insert into public.mythic_graph_jobs (scope, job_type, max_retries)
  values (p_scope, p_job_type, p_max_retries)
  returning id into v_job_id;

  return v_job_id;
end;
$$;

create or replace function public.mark_mythic_graph_job_processing(p_job_id uuid)
returns void
language plpgsql security definer
as $$
begin
  update public.mythic_graph_jobs
  set status = 'processing',
      started_at = now(),
      updated_at = now()
  where id = p_job_id;
end;
$$;

create or replace function public.mark_mythic_graph_job_complete(
  p_job_id uuid,
  p_result jsonb default null
)
returns void
language plpgsql security definer
as $$
begin
  update public.mythic_graph_jobs
  set status = 'complete',
      result = p_result,
      completed_at = now(),
      updated_at = now()
  where id = p_job_id;
end;
$$;

create or replace function public.mark_mythic_graph_job_failed(
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
  from public.mythic_graph_jobs
  where id = p_job_id;

  v_retry_count := v_retry_count + 1;

  if p_should_retry and v_retry_count < v_max_retries then
    update public.mythic_graph_jobs
    set status = 'pending',
        retry_count = v_retry_count,
        error_message = p_error_message,
        updated_at = now()
    where id = p_job_id;
  else
    update public.mythic_graph_jobs
    set status = 'failed',
        retry_count = v_retry_count,
        error_message = p_error_message,
        completed_at = now(),
        updated_at = now()
    where id = p_job_id;
  end if;
end;
$$;

create or replace function public.cleanup_completed_mythic_graph_jobs(p_days_to_keep int default 30)
returns int
language plpgsql security definer
as $$
declare
  v_deleted_count int;
begin
  delete from public.mythic_graph_jobs
  where status in ('complete', 'failed')
    and completed_at < now() - (p_days_to_keep || ' days')::interval;

  get diagnostics v_deleted_count = row_count;
  return v_deleted_count;
end;
$$;

-- ── 3. Derivation Helper Functions (lightweight, called from triggers) ───────

-- Create a mix node + basic edges when a mix is published.
-- This is intentionally simple in 043; heavier work (similarity, embeddings)
-- is expected to be handled by enqueued jobs.
create or replace function public.derive_mix_node(p_mix_id uuid)
returns uuid
language plpgsql security definer
as $$
declare
  v_mix record;
  v_node_id uuid;
begin
  select * into v_mix from public.mixes where id = p_mix_id and published = true;
  if not found then
    return null;
  end if;

  -- Create the node (idempotent via source lookup)
  select id into v_node_id
  from public.mythic_nodes
  where source_table = 'mixes' and source_id = p_mix_id::text;

  if v_node_id is not null then
    return v_node_id;
  end if;

  insert into public.mythic_nodes (
    node_type, owner_id, source_table, source_id, title, payload, occurred_at
  )
  values (
    'mix',
    v_mix.dj_id,
    'mixes',
    p_mix_id::text,
    v_mix.title,
    jsonb_build_object(
      'genre_id', v_mix.genre_id,
      'tags', v_mix.tags,
      'duration_seconds', v_mix.duration_seconds,
      'is_explicit', v_mix.is_explicit
    ),
    v_mix.created_at
  )
  returning id into v_node_id;

  -- Create the "created" relationship (we treat the owner -> mix as engaged_with with high weight for now)
  if exists (select 1 from public.mythic_nodes where source_table = 'profiles' and source_id = v_mix.dj_id::text) then
    insert into public.mythic_edges (
      from_node_id, to_node_id, edge_type, weight, occurred_at, source_event
    )
    values (
      (select id from public.mythic_nodes where source_table = 'profiles' and source_id = v_mix.dj_id::text),
      v_node_id,
      'engaged_with',
      5.0,
      v_mix.created_at,
      'mix_publish:046'
    );
  end if;

  return v_node_id;
end;
$$;

-- Create a submitted_to edge when a user saves/applies to an opportunity.
create or replace function public.derive_opportunity_submission(
  p_user_id uuid,
  p_opportunity_id uuid,
  p_status text
)
returns void
language plpgsql security definer
as $$
declare
  v_artist_node_id uuid;
  v_opp_node_id uuid;
begin
  -- Ensure nodes exist (lightweight)
  select id into v_artist_node_id from public.mythic_nodes
  where source_table = 'profiles' and source_id = p_user_id::text;

  select id into v_opp_node_id from public.mythic_nodes
  where source_table = 'opportunities' and source_id = p_opportunity_id::text;

  if v_artist_node_id is null or v_opp_node_id is null then
    return; -- nodes will be created by other paths or backfill
  end if;

  insert into public.mythic_edges (
    from_node_id, to_node_id, edge_type, weight, occurred_at, source_event, metadata
  )
  values (
    v_artist_node_id,
    v_opp_node_id,
    'submitted_to',
    3.0,
    now(),
    'opportunity_save:046',
    jsonb_build_object('status', p_status)
  )
  on conflict do nothing;
end;
$$;

-- ── 4. Automatic Derivation Triggers ──────────────────────────────────────────

-- Trigger: when a mix becomes published, derive its node
create or replace function public.trg_derive_mix_on_publish()
returns trigger
language plpgsql
as $$
begin
  if NEW.published = true and (OLD.published is distinct from true) then
    perform public.derive_mix_node(NEW.id);
    -- Optionally enqueue heavier work
    perform public.enqueue_mythic_graph_job(
      jsonb_build_object('mix_id', NEW.id, 'user_id', NEW.dj_id),
      'derive_similarity_edges'
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_mythic_mix_publish on public.mixes;
create trigger trg_mythic_mix_publish
  after update on public.mixes
  for each row
  execute function public.trg_derive_mix_on_publish();

-- Trigger: when an opportunity_saves row is created/updated, derive the edge
create or replace function public.trg_derive_opportunity_edge()
returns trigger
language plpgsql
as $$
begin
  perform public.derive_opportunity_submission(NEW.user_id, NEW.opportunity_id, NEW.status);
  return NEW;
end;
$$;

drop trigger if exists trg_mythic_opportunity_save on public.opportunity_saves;
create trigger trg_mythic_opportunity_save
  after insert or update on public.opportunity_saves
  for each row
  execute function public.trg_derive_opportunity_edge();

-- Note: Follows trigger is intentionally omitted in 043 for now.
-- We can add a lightweight version later when we decide on the right
-- balance between real-time edge creation vs. batched derivation jobs.

-- ── 5. Future Work Comments (for Codex) ───────────────────────────────────────

-- Recommended next pieces (in rough order):
--   A. Implement the actual worker loop that can process 'derive_similarity_edges',
--      'generate_node_embeddings', etc. (modeled on job-processor.ts + audio-processing.ts).
--   B. RPCs the Python Lua runtime can call for on-demand light derivation.
--   C. Backfill script (one-time + periodic) that walks existing mixes, opportunities, follows.
--   D. More triggers (e.g. on new 'performed_at' manual logs once that feature exists).
--   E. Quest progress evaluation job that looks for quest_milestone edges.

commit;