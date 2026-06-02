-- Migration 067: Phase 8 — materialized views, agent state persistence, Phase 8 graph prep
--
-- Adds:
--   1. mv_artist_similarity_scores — pre-computed similar-artist pairs from mythic_edges
--   2. mv_venue_impact_by_genre    — venue engagement by genre (hourly stats)
--   3. agent_state_user            — durable per-user agent memory
--   4. agent_state_session         — durable per-session agent context
--   5. agent_events                — append-only agent audit log
--   6. pg_cron jobs for mat-view refresh and agent_events pruning
--
-- No schema changes to mythic_nodes / mythic_edges — weight and source_table/source_id
-- already exist from migrations 045 and 065.
--
-- Resolves: Phase 8 docs 30 (schema strategies) and 31 (agent state persistence)

begin;

-- ── 1. Materialized view: artist similarity scores ────────────────────────────

create materialized view if not exists public.mv_artist_similarity_scores as
select
  e.from_node_id  as artist_a,
  e.to_node_id    as artist_b,
  e.weight        as similarity_score,
  e.metadata      as edge_props,
  e.created_at
from public.mythic_edges e
where e.edge_type = 'similar_artist'
with data;

create unique index if not exists uniq_mv_artist_sim
  on public.mv_artist_similarity_scores (artist_a, artist_b);

create index if not exists idx_mv_artist_sim_b
  on public.mv_artist_similarity_scores (artist_b);

-- ── 2. Materialized view: venue impact by genre ───────────────────────────────

create materialized view if not exists public.mv_venue_impact_by_genre as
select
  venue_node.id                                      as venue_node_id,
  (e.metadata->>'genre')::text                       as genre,
  count(*)                                           as event_count,
  avg(nullif(e.metadata->>'event_size', '')::int)    as avg_event_size,
  sum(e.weight)                                      as total_impact_score
from public.mythic_edges e
join public.mythic_nodes venue_node
  on venue_node.id = e.to_node_id
  and venue_node.node_type = 'venue'
where e.edge_type = 'performed_at'
group by venue_node.id, (e.metadata->>'genre')::text
with data;

create index if not exists idx_mv_venue_impact_genre
  on public.mv_venue_impact_by_genre (genre);

create index if not exists idx_mv_venue_impact_venue
  on public.mv_venue_impact_by_genre (venue_node_id);

-- ── 3. agent_state_user — durable per-user agent memory ──────────────────────

create table if not exists public.agent_state_user (
  user_id     uuid    not null references auth.users(id) on delete cascade,
  agent_id    text    not null,
  state_json  jsonb   not null default '{}',
  updated_at  timestamptz not null default now(),
  primary key (user_id, agent_id),
  constraint agent_state_user_size check (
    octet_length(state_json::text) <= 65536
  )
);

create index if not exists idx_agent_state_user_agent
  on public.agent_state_user (agent_id);

alter table public.agent_state_user enable row level security;

drop policy if exists "user own agent state" on public.agent_state_user;
create policy "user own agent state"
  on public.agent_state_user for all
  using (user_id = auth.uid());

-- ── 4. agent_state_session — durable per-session agent context ───────────────

create table if not exists public.agent_state_session (
  session_id  uuid    not null references public.collab_sessions(id) on delete cascade,
  agent_id    text    not null,
  state_json  jsonb   not null default '{}',
  updated_at  timestamptz not null default now(),
  primary key (session_id, agent_id),
  constraint agent_state_session_size check (
    octet_length(state_json::text) <= 65536
  )
);

alter table public.agent_state_session enable row level security;

drop policy if exists "session participant read agent state" on public.agent_state_session;
create policy "session participant read agent state"
  on public.agent_state_session for select
  using (
    exists (
      select 1 from public.collab_session_participants csp
      where csp.session_id = agent_state_session.session_id
        and csp.profile_id = auth.uid()
    )
  );

-- ── 5. agent_events — append-only audit log ──────────────────────────────────

create table if not exists public.agent_events (
  id          uuid    primary key default gen_random_uuid(),
  agent_id    text    not null,
  user_id     uuid    references auth.users(id) on delete set null,
  session_id  uuid    references public.collab_sessions(id) on delete set null,
  event_type  text    not null,
  payload     jsonb   not null default '{}',
  created_at  timestamptz not null default now()
);

create index if not exists idx_agent_events_user
  on public.agent_events (user_id, agent_id, created_at desc)
  where user_id is not null;

create index if not exists idx_agent_events_session
  on public.agent_events (session_id, created_at desc)
  where session_id is not null;

alter table public.agent_events enable row level security;

drop policy if exists "user own agent events" on public.agent_events;
create policy "user own agent events"
  on public.agent_events for select
  using (user_id = auth.uid());

-- ── 6. pg_cron jobs ───────────────────────────────────────────────────────────

-- Refresh similarity scores hourly
do $$
begin
  if not exists (
    select 1 from pg_extension where extname = 'pg_cron'
  ) then
    raise notice 'pg_cron not enabled — skipping cron schedule for mat-view refresh';
  else
    perform cron.schedule(
      'refresh-artist-similarity',
      '0 * * * *',
      'refresh materialized view concurrently public.mv_artist_similarity_scores'
    );

    perform cron.schedule(
      'refresh-venue-impact',
      '0 3 * * *',
      'refresh materialized view concurrently public.mv_venue_impact_by_genre'
    );

    -- Prune agent_events older than 90 days
    perform cron.schedule(
      'purge-agent-events',
      '0 4 * * *',
      'delete from public.agent_events where created_at < now() - interval ''90 days'''
    );
  end if;
end$$;

-- Resolves: Phase 8 docs 30 and 31

commit;
