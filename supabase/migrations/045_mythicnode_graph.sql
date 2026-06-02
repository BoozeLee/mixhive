-- Migration 045: MythicNode Graph — nodes, edges, quests, and milestones
--
-- This migration introduces the core data layer for MIXHIVE's MythicNode
-- concept: a queryable, attributable graph of creators, content, venues,
-- events, opportunities, and agent-generated narrative "quests".
--
-- Nodes represent entities (artist_profile, mix, venue, opportunity, quest, etc.).
-- Edges represent relationships and actions (performed_at, submitted_to,
-- collab_with, recommended_by_agent, yielded_outcome, etc.).
--
-- Quests are first-class, agent-maintained narrative goals with milestones.
--
-- Design constraints (Phase 6):
-- - Postgres as system of record (no external graph DB)
-- - Full traceability back to source tables (mixes, profiles, opportunities, etc.)
-- - RLS-first; owners fully control their own graph/quests
-- - Designed to be populated via triggers + background workers (following
--   the audio_jobs pattern from migration 040)
--
-- Resolves: Phase 6 MythicNode foundation (docs 11-14)
--
-- Follow-ups expected:
-- - 046 or 047: Derivation triggers, backfill functions, mythic_graph_jobs
--   worker support (enqueue_mythic_graph_job etc.)
-- - Later: Embedding refresh jobs, similarity edge materialization

begin;

-- ── 1. mythic_nodes ───────────────────────────────────────────────────────────

create table if not exists public.mythic_nodes (
  id uuid primary key default gen_random_uuid(),

  -- Discriminator for the entity type
  node_type text not null check (node_type in (
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
    'agent'
  )),

  -- The primary artist who "owns" this node in their personal legend
  -- (null for globally interesting entities like major venues)
  owner_id uuid references public.profiles(id) on delete set null,

  -- Traceability back to the canonical row that produced this node
  source_table text,                    -- e.g. 'mixes', 'opportunities', 'manual', 'agent'
  source_id text,                       -- uuid or natural key stored as text

  -- Denormalized title for fast display in agent output / UI
  title text,

  -- Flexible attributes (genres, city, tags, role, etc.)
  payload jsonb not null default '{}',

  -- When the real-world thing happened (gig date, mix publish date, etc.)
  occurred_at timestamptz,

  created_at timestamptz not null default now(),

  -- Optional vector embedding for similarity / recommendation work
  -- (populated by later background jobs; 1536 dim matches common OpenAI models)
  embedding vector(1536)
);

-- Useful indexes
create index if not exists idx_mythic_nodes_type on public.mythic_nodes(node_type);
create index if not exists idx_mythic_nodes_owner on public.mythic_nodes(owner_id) where owner_id is not null;
create index if not exists idx_mythic_nodes_source on public.mythic_nodes(source_table, source_id);
create index if not exists idx_mythic_nodes_created on public.mythic_nodes(created_at desc);

-- Vector index (will be useful once embeddings are populated)
create index if not exists idx_mythic_nodes_embedding
  on public.mythic_nodes using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

comment on table public.mythic_nodes is
  'Core nodes of the MythicNode graph. Every meaningful entity in a creator''s career journey (profiles, mixes, gigs, opportunities, quests, etc.). Populated via backfill + triggers + agent actions.';

-- ── 2. mythic_edges ───────────────────────────────────────────────────────────

create table if not exists public.mythic_edges (
  id uuid primary key default gen_random_uuid(),

  from_node_id uuid not null references public.mythic_nodes(id) on delete cascade,
  to_node_id   uuid not null references public.mythic_nodes(id) on delete cascade,

  -- Relationship / action type
  edge_type text not null check (edge_type in (
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
    'yielded_outcome'
  )),

  -- Strength / relevance weight (used for scoring and ranking)
  weight numeric(6,3) not null default 1.0,

  occurred_at timestamptz,

  -- Rich context (role on a bill, agent that made the recommendation, evidence, etc.)
  metadata jsonb not null default '{}',

  -- How this edge was created (for audit + debugging)
  source_event text,                    -- e.g. 'mix_publish', 'user_action:log_gig', 'lua_agent:abc123', 'backfill:045'

  created_at timestamptz not null default now()
);

-- Critical indexes for graph queries (ego graph, triangles, path finding)
create index if not exists idx_mythic_edges_from on public.mythic_edges(from_node_id);
create index if not exists idx_mythic_edges_to on public.mythic_edges(to_node_id);
create index if not exists idx_mythic_edges_type on public.mythic_edges(edge_type);
create index if not exists idx_mythic_edges_from_type on public.mythic_edges(from_node_id, edge_type);
create index if not exists idx_mythic_edges_composite on public.mythic_edges(from_node_id, to_node_id, edge_type);
create index if not exists idx_mythic_edges_created on public.mythic_edges(created_at desc);

comment on table public.mythic_edges is
  'Directed relationships and actions between MythicNodes. The primary source of career memory and attribution (e.g. "this mix + this agent suggestion yielded this actual booking").';

-- ── 3. Quests and Milestones ──────────────────────────────────────────────────

create table if not exists public.quests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,

  title text not null,
  description text,

  -- e.g. ['techno', 'brussels', 'melodic']
  target_scene_tags text[] not null default '{}',

  timeframe_days int,

  status text not null default 'active'
    check (status in ('active', 'paused', 'completed', 'abandoned')),

  -- Agent-computed momentum / health signal (0-100 or similar)
  momentum numeric(5,2) default 0,

  -- Which agent (if any) originally proposed or is maintaining this quest
  created_by_agent_id uuid references public.lua_agents(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_quests_owner_status on public.quests(owner_id, status, created_at desc);

comment on table public.quests is
  'Agent-maintained narrative career goals ("Break into the Brussels melodic techno scene in 90 days"). First-class objects with milestones and provenance.';

create table if not exists public.quest_milestones (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid not null references public.quests(id) on delete cascade,

  title text not null,
  sort_order int not null default 0,

  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed', 'skipped')),

  -- Optional hint about what kind of node would complete this milestone
  target_node_type text,

  completed_at timestamptz,

  -- Link to the specific edge that proved completion (powerful for attribution)
  completed_via_edge_id uuid references public.mythic_edges(id)
);

create index if not exists idx_quest_milestones_quest on public.quest_milestones(quest_id, sort_order);

-- Optional junction table for "this milestone was evidenced by these nodes"
create table if not exists public.quest_milestone_evidence (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid not null references public.quests(id) on delete cascade,
  milestone_id uuid not null references public.quest_milestones(id) on delete cascade,
  node_id uuid not null references public.mythic_nodes(id) on delete cascade,
  created_at timestamptz not null default now(),

  unique (milestone_id, node_id)
);

-- ── 4. Row Level Security ─────────────────────────────────────────────────────

alter table public.mythic_nodes enable row level security;
alter table public.mythic_edges enable row level security;
alter table public.quests enable row level security;
alter table public.quest_milestones enable row level security;
alter table public.quest_milestone_evidence enable row level security;

-- Owners have full control over their own nodes, edges, and quests
drop policy if exists "Owners manage their mythic nodes" on public.mythic_nodes;
create policy "Owners manage their mythic nodes"
  on public.mythic_nodes for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Some nodes are "public" in the same spirit as opportunities (venues, big promoters, etc.)
-- For Phase 6 we start conservative: if owner_id is null, anyone can read.
drop policy if exists "Public mythic nodes are readable" on public.mythic_nodes;
create policy "Public mythic nodes are readable"
  on public.mythic_nodes for select
  using (owner_id is null);

-- Edges are visible to the owner of the *from* node (most common access pattern)
drop policy if exists "Owners see edges from their nodes" on public.mythic_edges;
create policy "Owners see edges from their nodes"
  on public.mythic_edges for select
  using (
    exists (
      select 1 from public.mythic_nodes n
      where n.id = mythic_edges.from_node_id
        and n.owner_id = auth.uid()
    )
  );

-- Quest visibility: owner full control
drop policy if exists "Owners manage their quests" on public.quests;
create policy "Owners manage their quests"
  on public.quests for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Milestones and evidence follow quest ownership
drop policy if exists "Owners manage quest milestones" on public.quest_milestones;
create policy "Owners manage quest milestones"
  on public.quest_milestones for all
  using (
    exists (
      select 1 from public.quests q
      where q.id = quest_milestones.quest_id
        and q.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.quests q
      where q.id = quest_milestones.quest_id
        and q.owner_id = auth.uid()
    )
  );

drop policy if exists "Owners manage quest milestone evidence" on public.quest_milestone_evidence;
create policy "Owners manage quest milestone evidence"
  on public.quest_milestone_evidence for all
  using (
    exists (
      select 1 from public.quests q
      where q.id = quest_milestone_evidence.quest_id
        and q.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.quests q
      where q.id = quest_milestone_evidence.quest_id
        and q.owner_id = auth.uid()
    )
  );

-- ── 5. Basic Helper Functions (stubs for later expansion) ─────────────────────

-- Lightweight function to record a simple graph event.
-- Full derivation logic (backfill, triggers, similarity) will live in follow-up migrations.
create or replace function public.record_mythic_event(
  p_node_type text,
  p_owner_id uuid,
  p_source_table text,
  p_source_id text,
  p_title text default null,
  p_payload jsonb default '{}',
  p_occurred_at timestamptz default null
)
returns uuid
language plpgsql security definer
as $$
declare
  v_node_id uuid;
begin
  insert into public.mythic_nodes (
    node_type, owner_id, source_table, source_id, title, payload, occurred_at
  )
  values (
    p_node_type, p_owner_id, p_source_table, p_source_id, p_title, p_payload, p_occurred_at
  )
  returning id into v_node_id;

  return v_node_id;
end;
$$;

comment on function public.record_mythic_event is
  'Simple helper to create a mythic_node with traceability. Used by backfill scripts and early agent logic. More sophisticated derivation will be added in 046/047.';

-- ── 6. Future-proofing notes ──────────────────────────────────────────────────

-- In a follow-up migration we will add:
--   - enqueue_mythic_graph_job(...) following the exact audio_jobs contract
--   - mark_mythic_graph_job_processing / complete / failed
--   - Trigger on key tables (mixes, opportunity_saves, follows, etc.) to call record_mythic_event
--   - Periodic job for embedding generation and similarity edge materialization

commit;