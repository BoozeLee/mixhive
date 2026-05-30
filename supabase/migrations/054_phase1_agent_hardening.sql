-- Migration 054: Phase 1 agent infrastructure hardening
--
-- Adds the missing pieces required by the Phase 1 plan:
--   1. agent_script_versions — immutable audit log of every script change
--      with promote/rollback support for the admin UI.
--   2. lua_agent_states — persistent key-value state store for strategic
--      agents (scoped per agent+profile, with optional TTL).
--   3. Hardened RLS — agent_registry is now service-role write-only;
--      agent_runs gets an insert policy for the service role; new tables
--      are fully locked down.
--   4. find_candidate_venues — security-definer Postgres function that
--      provides a safe, permission-checked venue lookup agents can call
--      via db.rpc("find_candidate_venues", ...).
--   5. venues table — created if not present so find_candidate_venues works.
--   6. Mythic strategic agents seeded into agent_registry (omitted from 035).
--
-- Resolves: Phase 1 Lua agent infrastructure hardening

begin;

-- =====================================================================
-- 1. venues table (may already exist; fully idempotent)
-- =====================================================================

create table if not exists public.venues (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  city        text,
  country     text not null default 'BE',
  genres      text[] not null default '{}',
  capacity    integer,
  description text,
  website_url text,
  contact_email text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_venues_city     on public.venues(city)    where is_active;
create index if not exists idx_venues_country  on public.venues(country) where is_active;
create index if not exists idx_venues_genres   on public.venues using gin(genres);

alter table public.venues enable row level security;

drop policy if exists "Venues are publicly readable" on public.venues;
create policy "Venues are publicly readable"
  on public.venues for select
  using (is_active = true);

-- =====================================================================
-- 2. agent_script_versions — full audit trail for every agent script
-- =====================================================================

create table if not exists public.agent_script_versions (
  id          bigint generated always as identity primary key,
  agent_id    text not null references public.agent_registry(id) on delete cascade,
  version     integer not null,
  lua_script  text not null,
  notes       text,
  author      text,
  promoted_at timestamptz,     -- null = not yet promoted to live
  rolled_back_at timestamptz,  -- non-null = this version was rolled back
  created_at  timestamptz not null default now(),

  unique(agent_id, version)
);

create index if not exists idx_agent_script_versions_agent
  on public.agent_script_versions(agent_id, version desc);

alter table public.agent_script_versions enable row level security;

-- Only service role can read/write script versions (admin UI uses service key)
drop policy if exists "Admin reads script versions" on public.agent_script_versions;
create policy "Admin reads script versions"
  on public.agent_script_versions for select
  using (auth.role() = 'service_role');

drop policy if exists "Admin writes script versions" on public.agent_script_versions;
create policy "Admin writes script versions"
  on public.agent_script_versions for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Seed version 1 for all existing agents from the registry
insert into public.agent_script_versions (agent_id, version, lua_script, notes, author, promoted_at)
select
  id,
  1,
  lua_script,
  'Initial version — seeded from migration 054',
  'system',
  now()
from public.agent_registry
on conflict (agent_id, version) do nothing;

-- =====================================================================
-- 3. lua_agent_states — persistent key-value state for strategic agents
-- =====================================================================

create table if not exists public.lua_agent_states (
  id          bigint generated always as identity primary key,
  agent_id    text not null references public.agent_registry(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  state_key   text not null check (char_length(state_key) between 1 and 128),
  state_value text not null check (char_length(state_value) <= 4096),
  expires_at  timestamptz,
  updated_at  timestamptz not null default now(),

  unique(agent_id, profile_id, state_key)
);

create index if not exists idx_lua_agent_states_lookup
  on public.lua_agent_states(agent_id, profile_id);

create index if not exists idx_lua_agent_states_expiry
  on public.lua_agent_states(expires_at)
  where expires_at is not null;

alter table public.lua_agent_states enable row level security;

-- Users can read their own agent states; service role reads all
drop policy if exists "Users read own agent states" on public.lua_agent_states;
create policy "Users read own agent states"
  on public.lua_agent_states for select
  using (profile_id = auth.uid() or auth.role() = 'service_role');

drop policy if exists "Service role manages agent states" on public.lua_agent_states;
create policy "Service role manages agent states"
  on public.lua_agent_states for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Hourly TTL sweep for expired states
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'lua_agent_states_ttl_sweep',
      '15 * * * *',
      $cron$delete from public.lua_agent_states where expires_at is not null and expires_at < now()$cron$
    );
  end if;
end$$;

-- =====================================================================
-- 4. Harden RLS on agent_registry and agent_runs
-- =====================================================================

-- agent_registry: read = public (enabled agents only), write = service only
drop policy if exists "Service manages agent registry" on public.agent_registry;
create policy "Service manages agent registry"
  on public.agent_registry for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- agent_runs: users see own runs; service role inserts (no user insert)
drop policy if exists "Service inserts agent runs" on public.agent_runs;
create policy "Service inserts agent runs"
  on public.agent_runs for insert
  with check (auth.role() = 'service_role');

-- =====================================================================
-- 5. find_candidate_venues — safe, permission-checked RPC for agents
-- =====================================================================

create or replace function public.find_candidate_venues(
  p_genres  text[]    default '{}',
  p_city    text      default null,
  p_country text      default 'BE',
  p_limit   integer   default 10
)
returns table (
  id            uuid,
  name          text,
  city          text,
  country       text,
  genres        text[],
  capacity      integer,
  description   text,
  website_url   text,
  genre_overlap integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    v.id,
    v.name,
    v.city,
    v.country,
    v.genres,
    v.capacity,
    v.description,
    v.website_url,
    (
      select count(*)::integer
      from unnest(v.genres) g
      where g = any(p_genres)
    ) as genre_overlap
  from public.venues v
  where
    v.is_active = true
    and (p_city    is null or lower(v.city)    = lower(p_city))
    and (p_country is null or lower(v.country) = lower(p_country))
    and (
      cardinality(p_genres) = 0
      or v.genres && p_genres
    )
  order by
    genre_overlap desc,
    v.capacity nulls last
  limit least(p_limit, 50);
$$;

-- Only callable by service role or authenticated users (via trusted server-side code)
revoke all on function public.find_candidate_venues(text[], text, text, integer) from public;
grant execute on function public.find_candidate_venues(text[], text, text, integer)
  to service_role, authenticated;

-- =====================================================================
-- 6. match_ai_embeddings RPC (ensure it exists for vector.search)
-- =====================================================================

create or replace function public.match_ai_embeddings(
  p_entity_type text,
  p_embedding   vector(1536),
  p_threshold   float8 default 0.65,
  p_limit       integer default 10
)
returns table (
  entity_id   text,
  entity_type text,
  similarity  float8,
  metadata    jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    entity_id::text,
    entity_type,
    1 - (embedding <=> p_embedding) as similarity,
    metadata
  from public.ai_embeddings
  where
    entity_type = p_entity_type
    and 1 - (embedding <=> p_embedding) >= p_threshold
  order by embedding <=> p_embedding
  limit least(p_limit, 100);
$$;

revoke all on function public.match_ai_embeddings(text, vector, float8, integer) from public;
grant execute on function public.match_ai_embeddings(text, vector, float8, integer)
  to service_role, authenticated;

-- =====================================================================
-- 7. Seed mythic strategic agents into agent_registry (missing from 035)
-- =====================================================================

insert into public.agent_registry (
  id, display_name, description, tier,
  tools_whitelist, approval_policy, timeout_ms, lua_script
) values
  (
    'mythic_scene_orbit',
    'Mythic Scene Orbit',
    'Maintains career quests and proposes high-yield scene actions using the MythicNode graph.',
    'pro',
    array['db.read_one','db.read','llm.call','llm.json','mythic.quest.get_active','mythic.graph.query'],
    'always', 45000,
    '-- loaded from version-controlled agent source'
  ),
  (
    'mythic_collab_weaver',
    'Mythic Collab Weaver',
    'Identifies high-yield collaboration opportunities with provenance and historical conversion signals.',
    'pro',
    array['db.read_one','db.read','llm.call','llm.json','mythic.graph.query'],
    'always', 45000,
    '-- loaded from version-controlled agent source'
  ),
  (
    'mythic_narrator',
    'Mythic Narrator',
    'Writes living, graph-grounded career narrative chapters.',
    'pro',
    array['db.read_one','llm.call','mythic.graph.query'],
    'on_action', 30000,
    '-- loaded from version-controlled agent source'
  ),
  (
    'mythic_yield_analyst',
    'Mythic Yield Analyst',
    'Surfaces which of your actions actually produced real career outcomes.',
    'pro',
    array['db.read_one','db.read','llm.json','mythic.yield.get_summary','mythic.graph.query'],
    'always', 40000,
    '-- loaded from version-controlled agent source'
  )
on conflict (id) do update set
  display_name    = excluded.display_name,
  description     = excluded.description,
  tier            = excluded.tier,
  tools_whitelist = excluded.tools_whitelist,
  approval_policy = excluded.approval_policy,
  timeout_ms      = excluded.timeout_ms,
  updated_at      = now();

commit;

-- Resolves: Phase 1 Lua agent infrastructure hardening
