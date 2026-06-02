-- Migration 075: Vector similarity RPCs, get_profile_story, and profiles.show_journey
--
-- Adds 6 security-definer RPCs for Phase 10 AI features:
--   find_similar_mixes        — cosine similarity over published mixes
--   find_similar_artists      — cosine similarity over profiles
--   find_scene_neighbors      — cosine similarity over scene clusters
--   find_mixes_for_set_context— cosine + BPM join for Hive Composer
--   find_collab_candidates_hybrid — graph-first, vector-ranked collab suggestions
--   get_profile_story         — mythic_edges ordered chapter list for Hive Story
-- Also adds profiles.show_journey boolean (opt-in for Hive Story tab).
--
-- Resolves: Phase 10 docs 39 §3, 42 §2.3, 43 §1

begin;

-- show_journey opt-in flag
alter table public.profiles
  add column if not exists show_journey boolean not null default false;

-- ── find_similar_mixes ───────────────────────────────────────────────────────

create or replace function public.find_similar_mixes(
  p_mix_id uuid,
  p_k      int default 10
)
returns table (
  mix_id     uuid,
  title      text,
  artist     text,
  similarity float,
  bpm        numeric,
  camelot    text,
  genre      text
)
language plpgsql security definer set search_path = public as $$
declare
  v_embedding vector(1536);
begin
  select embedding into v_embedding
  from ai_embeddings
  where entity_type = 'mix' and entity_id = p_mix_id
  limit 1;

  if v_embedding is null then return; end if;

  set local hnsw.ef_search = 40;

  return query
  select
    m.id                                                     as mix_id,
    m.title                                                  as title,
    coalesce(p.username, p.display_name)                     as artist,
    1 - (ae.embedding <=> v_embedding)                       as similarity,
    af.bpm                                                   as bpm,
    af.camelot                                               as camelot,
    m.genre                                                  as genre
  from ai_embeddings ae
  join mixes m on m.id = ae.entity_id
  left join profiles p on p.id = m.user_id
  left join audio_features af on af.mix_id = m.id
  where ae.entity_type = 'mix'
    and ae.entity_id <> p_mix_id
    and m.is_published = true
  order by ae.embedding <=> v_embedding
  limit p_k;
end;
$$;

revoke execute on function find_similar_mixes from public;
grant execute on function find_similar_mixes to authenticated, service_role;

-- ── find_similar_artists ─────────────────────────────────────────────────────

create or replace function public.find_similar_artists(
  p_profile_id uuid,
  p_k          int default 10
)
returns table (
  profile_id  uuid,
  username    text,
  similarity  float,
  genre_tags  text[]
)
language plpgsql security definer set search_path = public as $$
declare
  v_embedding vector(1536);
begin
  select embedding into v_embedding
  from ai_embeddings
  where entity_type = 'profile' and entity_id = p_profile_id
  limit 1;

  if v_embedding is null then return; end if;

  set local hnsw.ef_search = 40;

  return query
  select
    pr.id                                        as profile_id,
    coalesce(pr.username, pr.display_name)       as username,
    1 - (ae.embedding <=> v_embedding)           as similarity,
    pr.genre_tags                                as genre_tags
  from ai_embeddings ae
  join profiles pr on pr.id = ae.entity_id
  where ae.entity_type = 'profile'
    and ae.entity_id <> p_profile_id
  order by ae.embedding <=> v_embedding
  limit p_k;
end;
$$;

revoke execute on function find_similar_artists from public;
grant execute on function find_similar_artists to authenticated, service_role;

-- ── find_scene_neighbors ─────────────────────────────────────────────────────

create or replace function public.find_scene_neighbors(
  p_scene_cluster_id uuid,
  p_k                int default 10
)
returns table (
  scene_cluster_id  uuid,
  similarity        float
)
language plpgsql security definer set search_path = public as $$
declare
  v_embedding vector(1536);
begin
  select embedding into v_embedding
  from ai_embeddings
  where entity_type = 'scene' and entity_id = p_scene_cluster_id
  limit 1;

  if v_embedding is null then return; end if;

  set local hnsw.ef_search = 40;

  return query
  select
    ae.entity_id                                 as scene_cluster_id,
    1 - (ae.embedding <=> v_embedding)           as similarity
  from ai_embeddings ae
  where ae.entity_type = 'scene'
    and ae.entity_id <> p_scene_cluster_id
  order by ae.embedding <=> v_embedding
  limit p_k;
end;
$$;

revoke execute on function find_scene_neighbors from public;
grant execute on function find_scene_neighbors to authenticated, service_role;

-- ── find_mixes_for_set_context ───────────────────────────────────────────────

create or replace function public.find_mixes_for_set_context(
  p_embedding vector(1536),
  p_bpm_min   int    default 0,
  p_bpm_max   int    default 999,
  p_k         int    default 10
)
returns table (
  mix_id     uuid,
  title      text,
  artist     text,
  similarity float,
  bpm        numeric,
  camelot    text,
  genre      text
)
language plpgsql security definer set search_path = public as $$
begin
  set local hnsw.ef_search = 40;

  return query
  select
    m.id                                                     as mix_id,
    m.title                                                  as title,
    coalesce(p.username, p.display_name)                     as artist,
    1 - (ae.embedding <=> p_embedding)                       as similarity,
    af.bpm                                                   as bpm,
    af.camelot                                               as camelot,
    m.genre                                                  as genre
  from ai_embeddings ae
  join mixes m on m.id = ae.entity_id
  left join profiles p on p.id = m.user_id
  left join audio_features af on af.mix_id = m.id
  where ae.entity_type = 'mix'
    and m.is_published = true
    and (af.bpm is null or (af.bpm >= p_bpm_min and af.bpm <= p_bpm_max))
  order by ae.embedding <=> p_embedding
  limit p_k;
end;
$$;

revoke execute on function find_mixes_for_set_context from public;
grant execute on function find_mixes_for_set_context to authenticated, service_role;

-- ── find_collab_candidates_hybrid ────────────────────────────────────────────

create or replace function public.find_collab_candidates_hybrid(
  p_profile_id uuid,
  p_k          int default 10
)
returns table (
  profile_id  uuid,
  username    text,
  similarity  float,
  graph_score float,
  genre_tags  text[]
)
language plpgsql security definer set search_path = public as $$
declare
  v_embedding  vector(1536);
  v_node_id    uuid;
begin
  select embedding into v_embedding
  from ai_embeddings
  where entity_type = 'profile' and entity_id = p_profile_id
  limit 1;

  if v_embedding is null then return; end if;

  select id into v_node_id
  from mythic_nodes
  where node_type = 'artist_profile' and external_id = p_profile_id
  limit 1;

  set local hnsw.ef_search = 40;

  return query
  with graph_candidates as (
    -- 2-hop graph candidates via collab_with edges
    select distinct mn2.external_id as candidate_id,
                   count(*)         as shared_connections
    from mythic_edges me1
    join mythic_edges me2 on me2.from_node_id = me1.to_node_id
                         and me2.edge_type = 'collab_with'
    join mythic_nodes mn2 on mn2.id = me2.to_node_id
    where me1.from_node_id = v_node_id
      and me1.edge_type in ('collab_with', 'similar_artist')
      and mn2.external_id <> p_profile_id
      and mn2.node_type = 'artist_profile'
    group by mn2.external_id
  )
  select
    pr.id                                                         as profile_id,
    coalesce(pr.username, pr.display_name)                        as username,
    1 - (ae.embedding <=> v_embedding)                            as similarity,
    coalesce(gc.shared_connections::float / 10.0, 0)              as graph_score,
    pr.genre_tags                                                 as genre_tags
  from ai_embeddings ae
  join profiles pr on pr.id = ae.entity_id
  left join graph_candidates gc on gc.candidate_id = pr.id
  where ae.entity_type = 'profile'
    and ae.entity_id <> p_profile_id
  order by
    (0.6 * (1 - (ae.embedding <=> v_embedding)) +
     0.4 * coalesce(gc.shared_connections::float / 10.0, 0)) desc
  limit p_k;
end;
$$;

revoke execute on function find_collab_candidates_hybrid from public;
grant execute on function find_collab_candidates_hybrid to authenticated, service_role;

-- ── get_profile_story ────────────────────────────────────────────────────────

create or replace function public.get_profile_story(p_profile_id uuid)
returns table (
  chapter_type  text,
  label         text,
  date          timestamptz,
  is_chapter    boolean,
  props         jsonb
)
language plpgsql security definer set search_path = public as $$
declare
  v_node_id uuid;
begin
  select id into v_node_id
  from mythic_nodes
  where node_type = 'artist_profile' and external_id = p_profile_id
  limit 1;

  if v_node_id is null then return; end if;

  return query
  with ordered_edges as (
    select
      me.edge_type,
      coalesce(me.props->>'label', me.edge_type) as label,
      me.created_at,
      me.props,
      row_number() over (partition by me.edge_type order by me.created_at asc) as rn
    from mythic_edges me
    where me.from_node_id = v_node_id
    order by me.created_at asc
    limit 50
  )
  select
    case oe.edge_type
      when 'collab_with'          then 'collab'
      when 'performed_at'         then 'gig'
      when 'owns_nft_of'          then 'gig_proof'
      when 'submitted_to'         then 'opportunity'
      when 'quest_milestone'      then 'quest'
      when 'session_produced_mix' then 'set'
      when 'backed_quest'         then 'quest_backing'
      else 'other'
    end                    as chapter_type,
    oe.label               as label,
    oe.created_at          as date,
    (oe.rn = 1)            as is_chapter,
    oe.props               as props
  from ordered_edges oe
  order by oe.created_at asc;
end;
$$;

revoke execute on function get_profile_story from public;
grant execute on function get_profile_story to authenticated, service_role;

commit;
