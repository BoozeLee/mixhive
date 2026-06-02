-- Migration 064: Lua graph tools for user-agent runtime
--
-- Adds 4 security-definer RPCs callable exclusively by the Python Lua sandbox
-- (api/lua-agent/run.py via service_role) to expose graph intelligence to
-- user-authored Lua agents via mh.get_similar_artists(), mh.get_relevant_opportunities(),
-- mh.get_quest_momentum(), and mh.propose_quest().
--
-- All functions are service_role only — no public, no authenticated client access.
-- Rate limit on lua_propose_quest: max 3 agent-proposed quests per owner per 30 days.
--
-- Resolves: Phase 6 — Lua graph tool surface for user automation agents

begin;

-- ── 1. lua_get_similar_artists ────────────────────────────────────────────────

create or replace function public.lua_get_similar_artists(
  p_owner_id  uuid,
  p_limit     int  default 10
)
returns table (
  artist_id     uuid,
  display_name  text,
  username      text,
  avatar_url    text,
  shared_score  numeric
)
language plpgsql stable security definer
set search_path = public
as $$
begin
  return query
  select
    p.id              as artist_id,
    p.display_name,
    p.username,
    p.avatar_url,
    s.score           as shared_score
  from public.find_similar_artists_by_graph_overlap(
    p_owner_id,
    2,                       -- min_shared signals required
    least(p_limit, 20),      -- hard cap at 20
    365
  ) s
  join public.mythic_nodes mn on mn.id = s.artist_node_id
                              and mn.node_type = 'artist_profile'
  join public.profiles p      on p.id = mn.owner_id
  where mn.owner_id != p_owner_id
  order by s.score desc;
end;
$$;

revoke all on function public.lua_get_similar_artists(uuid, int) from public;
grant  execute on function public.lua_get_similar_artists(uuid, int) to service_role;

-- ── 2. lua_get_relevant_opportunities ────────────────────────────────────────

create or replace function public.lua_get_relevant_opportunities(
  p_owner_id  uuid,
  p_limit     int  default 10
)
returns table (
  opp_id       uuid,
  title        text,
  opp_type     text,
  city         text,
  deadline     date,
  genres       text[],
  match_score  int
)
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_artist_genres   text[];
  v_base_city       text;
begin
  -- Personalisation signals from artist_goals
  select ag.base_city into v_base_city
  from   public.artist_goals ag
  where  ag.user_id = p_owner_id;

  -- Infer genre preferences from recently published mixes
  select array_agg(distinct tag)
  into   v_artist_genres
  from (
    select unnest(m.tags) as tag
    from   public.mixes m
    where  m.dj_id     = p_owner_id
      and  m.published = true
    order  by m.created_at desc
    limit  50
  ) t;

  return query
  select
    o.id       as opp_id,
    o.title,
    o.opp_type,
    o.city,
    o.deadline,
    o.genres,
    (
      -- genre overlap (0–9)
      coalesce(array_length(o.genres & coalesce(v_artist_genres, '{}'), 1), 0) * 3
      -- deadline proximity: within 14 days gets a bonus (0–7)
    + least(7, greatest(0, 14 - coalesce(o.deadline - current_date, 999)))
      -- city match bonus (0–2)
    + case when lower(coalesce(o.city, '')) = lower(coalesce(v_base_city, chr(0))) then 2 else 0 end
    )          as match_score
  from   public.opportunities o
  where  o.is_active = true
    and  (o.deadline is null or o.deadline >= current_date)
    and  not exists (
           select 1 from public.opportunity_saves os
           where  os.opportunity_id = o.id
             and  os.user_id        = p_owner_id
             and  os.status        != 'dismissed'
         )
  order  by match_score desc, o.deadline asc nulls last
  limit  least(p_limit, 20);
end;
$$;

revoke all on function public.lua_get_relevant_opportunities(uuid, int) from public;
grant  execute on function public.lua_get_relevant_opportunities(uuid, int) to service_role;

-- ── 3. lua_get_quest_momentum ─────────────────────────────────────────────────

create or replace function public.lua_get_quest_momentum(
  p_owner_id  uuid
)
returns table (
  quest_id          uuid,
  title             text,
  status            text,
  momentum          numeric,
  milestones_total  int,
  milestones_done   int,
  days_remaining    int
)
language plpgsql stable security definer
set search_path = public
as $$
begin
  return query
  select
    q.id                                                         as quest_id,
    q.title,
    q.status,
    q.momentum,
    count(qm.id)::int                                            as milestones_total,
    count(qm.id) filter (where qm.status = 'completed')::int     as milestones_done,
    case when q.timeframe_days is not null
         then greatest(0, q.timeframe_days
                         - (current_date - q.created_at::date))::int
         else null
    end                                                          as days_remaining
  from   public.quests q
  left   join public.quest_milestones qm on qm.quest_id = q.id
  where  q.owner_id = p_owner_id
    and  q.status in ('active', 'paused')
  group  by q.id, q.title, q.status, q.momentum, q.timeframe_days, q.created_at
  order  by (q.status = 'active') desc, q.updated_at desc
  limit  10;
end;
$$;

revoke all on function public.lua_get_quest_momentum(uuid) from public;
grant  execute on function public.lua_get_quest_momentum(uuid) to service_role;

-- ── 4. lua_propose_quest ──────────────────────────────────────────────────────

create or replace function public.lua_propose_quest(
  p_owner_id       uuid,
  p_agent_id       uuid,
  p_title          text,
  p_scene_tags     text[]  default '{}',
  p_timeframe_days int     default 90
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_recent_count  int;
  v_new_id        uuid;
begin
  select count(*) into v_recent_count
  from   public.quests
  where  owner_id             = p_owner_id
    and  created_by_agent_id is not null
    and  created_at          >= now() - interval '30 days';

  if v_recent_count >= 3 then
    return null;
  end if;

  insert into public.quests (
    owner_id, created_by_agent_id, title,
    target_scene_tags, timeframe_days, status
  ) values (
    p_owner_id,
    p_agent_id,
    left(trim(p_title), 200),
    coalesce(p_scene_tags, '{}'),
    p_timeframe_days,
    'active'
  )
  returning id into v_new_id;

  return v_new_id;
end;
$$;

revoke all on function public.lua_propose_quest(uuid, uuid, text, text[], int) from public;
grant  execute on function public.lua_propose_quest(uuid, uuid, text, text[], int) to service_role;

-- Resolves: Phase 6 — Lua graph tool surface for user automation agents
commit;
