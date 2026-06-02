-- Migration 065: experiment_events, collab_session_signals, realtime + graph extensions
--
-- Adds the A/B experiment event tracking table (doc 26), the WebRTC signalling
-- table for peer talkback in collab sessions (doc 27), enables Supabase Realtime
-- on collab_sessions, and extends the edge_type + node_type CHECK constraints to
-- cover collab_session and similar_artist/session_produced_mix edge types.
-- Composite graph query indexes from doc 24 are included here.
--
-- Resolves: Phase 7 — doc 26 (experiments) + doc 27 (realtime collab)

begin;

-- ── 1. experiment_events ────────────────────────────────────────────────────

create table if not exists public.experiment_events (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references profiles(id) on delete cascade,
  event_type   text not null,
  feature      text,
  variant      text,
  properties   jsonb default '{}',
  created_at   timestamptz not null default now()
);

create index if not exists idx_experiment_events_feature_variant_created
  on experiment_events (feature, variant, created_at);

create index if not exists idx_experiment_events_profile_type_created
  on experiment_events (profile_id, event_type, created_at);

-- RLS: users read their own rows; inserts are service_role only
alter table experiment_events enable row level security;

drop policy if exists "Users can read own experiment events" on experiment_events;
create policy "Users can read own experiment events"
  on experiment_events for select
  using (profile_id = auth.uid());

-- ── 2. collab_session_signals (WebRTC peer signalling — design-ready) ──────

create table if not exists public.collab_session_signals (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid references collab_sessions(id) on delete cascade,
  from_id      uuid references profiles(id),
  to_id        uuid references profiles(id),
  signal_type  text,   -- 'offer' | 'answer' | 'ice_candidate'
  payload      jsonb,
  created_at   timestamptz default now(),
  ttl_expires  timestamptz default now() + interval '2 minutes'
);

create index if not exists idx_collab_session_signals_session_to_created
  on collab_session_signals (session_id, to_id, created_at desc);

alter table collab_session_signals enable row level security;

drop policy if exists "Session participants can read signals" on collab_session_signals;
create policy "Session participants can read signals"
  on collab_session_signals for select
  using (
    to_id = auth.uid()
    or from_id = auth.uid()
  );

drop policy if exists "Session participants can insert signals" on collab_session_signals;
create policy "Session participants can insert signals"
  on collab_session_signals for insert
  with check (from_id = auth.uid());

-- ── 3. Enable Supabase Realtime on collab_sessions ─────────────────────────

do $$
begin
  alter publication supabase_realtime add table collab_sessions;
exception when duplicate_object then null;
end$$;

-- ── 4. Extend mythic_nodes.node_type to include 'collab_session' ───────────

alter table mythic_nodes drop constraint if exists mythic_nodes_node_type_check;
alter table mythic_nodes add constraint mythic_nodes_node_type_check
  check (node_type in (
    'artist_profile',
    'mix',
    'buzz',
    'event',
    'venue',
    'opportunity',
    'promoter',
    'label',
    'curator',
    'quest',
    'agent',
    'collab_session'
  ));

-- ── 5. Extend mythic_edges.edge_type ───────────────────────────────────────

alter table mythic_edges drop constraint if exists mythic_edges_edge_type_check;
alter table mythic_edges add constraint mythic_edges_edge_type_check
  check (edge_type in (
    'performed_at',
    'booked_by',
    'submitted_to',
    'collab_with',
    'remixed',
    'engaged_with',
    'recommended_by_agent',
    'followed',
    'inspired_by',
    'quest_milestone',
    'yielded_outcome',
    'similar_artist',
    'session_produced_mix'
  ));

-- ── 6. Composite graph-query indexes (doc 24) ──────────────────────────────

-- Fast edge traversal: source → all edges of a type
create index if not exists idx_mythic_edges_source_type_target
  on mythic_edges (from_node_id, edge_type, to_node_id);

-- Reverse traversal: target → incoming edges of a type
create index if not exists idx_mythic_edges_target_type_source
  on mythic_edges (to_node_id, edge_type, from_node_id);

-- Owner-scoped node lookup (e.g. "all quest nodes for user X")
create index if not exists idx_mythic_nodes_owner_type
  on mythic_nodes (owner_id, node_type);

-- Source-table + source-id for fast upserts
create index if not exists idx_mythic_nodes_source_table_id
  on mythic_nodes (source_table, source_id)
  where source_table is not null;

-- Recent edges for agent dedup (filter edges from last 30d)
create index if not exists idx_mythic_edges_type_occurred
  on mythic_edges (edge_type, occurred_at desc)
  where occurred_at is not null;

commit;

-- Resolves: Phase 7 doc 26 (experiment_events) + doc 27 (realtime collab + WebRTC signals)
