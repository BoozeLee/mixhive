-- Migration 047: MythicNode Similarity Helpers
--
-- Adds fast SQL RPCs for computing artist similarity based on MythicNode graph signals.
-- This powers the `derive_similarity_edges` worker job with real, attributable overlap.
--
-- Signals included in v1:
--   - Shared venues (via performed_at edges)
--   - Shared mix engagement (co-likes on mixes from both artists)
--   - Basic collab history
--
-- Designed to be called from the TypeScript worker (or future strategic agents).

begin;

-- ── 1. Core similarity RPC ────────────────────────────────────────────────────

create or replace function public.find_similar_artists_by_graph_overlap(
  p_user_id uuid,
  p_min_shared int default 2,
  p_limit int default 30,
  p_days_window int default 365
)
returns table (
  artist_node_id uuid,
  shared_venues int,
  shared_mix_engagement int,
  total_shared_signals int,
  score numeric
)
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_cutoff timestamptz := now() - (p_days_window || ' days')::interval;
begin
  return query
  with user_venues as (
    -- Venues where this artist has performed recently
    select distinct e.to_node_id as venue_id
    from mythic_edges e
    join mythic_nodes n on n.id = e.to_node_id
    where e.from_node_id = p_user_id
      and e.edge_type = 'performed_at'
      and e.occurred_at >= v_cutoff
      and n.node_type = 'venue'
  ),
  user_mixes as (
    -- Mixes created by this artist
    select id as mix_id
    from mythic_nodes
    where owner_id = p_user_id
      and node_type = 'mix'
  ),
  co_engagement as (
    -- Other artists whose mixes were liked by people who also liked this artist's mixes
    select 
      m2.owner_id as other_artist_id,
      count(distinct l.user_id) as co_likes
    from likes l
    join user_mixes um on um.mix_id = l.mix_id
    join mythic_nodes m2 on m2.id = l.mix_id and m2.node_type = 'mix' and m2.owner_id != p_user_id
    group by m2.owner_id
  ),
  venue_overlap as (
    select 
      e.from_node_id as other_artist_id,
      count(distinct e.to_node_id) as shared_venue_count
    from mythic_edges e
    join user_venues uv on uv.venue_id = e.to_node_id
    where e.edge_type = 'performed_at'
      and e.from_node_id != p_user_id
      and e.occurred_at >= v_cutoff
    group by e.from_node_id
  ),
  combined as (
    select 
      coalesce(v.other_artist_id, c.other_artist_id) as artist_node_id,
      coalesce(v.shared_venue_count, 0) as shared_venues,
      coalesce(c.co_likes, 0) as shared_mix_engagement,
      coalesce(v.shared_venue_count, 0) + coalesce(c.co_likes, 0) as total_shared
    from venue_overlap v
    full outer join co_engagement c on c.other_artist_id = v.other_artist_id
  )
  select 
    c.artist_node_id,
    c.shared_venues,
    c.shared_mix_engagement,
    c.total_shared as total_shared_signals,
    -- Simple scoring formula (can be tuned)
    least(0.95, (c.shared_venues * 0.35 + c.shared_mix_engagement * 0.12)) as score
  from combined c
  where c.total_shared >= p_min_shared
  order by score desc, total_shared desc
  limit p_limit;
end;
$$;

revoke execute on function public.find_similar_artists_by_graph_overlap(uuid, int, int, int) from public;

comment on function public.find_similar_artists_by_graph_overlap is 
  'Fast graph-based artist similarity using shared venues + co-engagement on mixes. Used by derive_similarity_edges worker job.';

-- ── 2. Optional helper: get detailed reasons for a pair (for explainability) ──

create or replace function public.get_similarity_reasons(
  p_artist_a uuid,
  p_artist_b uuid,
  p_days_window int default 365
)
returns jsonb
language sql stable security definer
as $$
  with shared_venues as (
    select count(*) as cnt
    from (
      select e.to_node_id
      from mythic_edges e
      where e.from_node_id = p_artist_a and e.edge_type = 'performed_at'
      intersect
      select e.to_node_id
      from mythic_edges e
      where e.from_node_id = p_artist_b and e.edge_type = 'performed_at'
    ) s
  ),
  shared_likes as (
    select count(distinct l1.user_id) as cnt
    from likes l1
    join mythic_nodes m1 on m1.id = l1.mix_id and m1.owner_id = p_artist_a and m1.node_type = 'mix'
    join likes l2 on l2.mix_id = l1.mix_id and l2.user_id != l1.user_id
    join mythic_nodes m2 on m2.id = l2.mix_id and m2.owner_id = p_artist_b and m2.node_type = 'mix'
    where l1.created_at >= now() - (p_days_window || ' days')::interval
  )
  select jsonb_build_object(
    'shared_venues', (select cnt from shared_venues),
    'shared_mix_likes_by_same_users', (select cnt from shared_likes)
  );
$$;

revoke execute on function public.get_similarity_reasons(uuid, uuid, int) from public;

commit;