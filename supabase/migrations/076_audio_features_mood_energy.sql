-- Migration 076: audio_features mood/energy columns + find_mixes_for_set_context genre_hint
--
-- Adds optional mood (text) and energy (float 0-1) columns to audio_features.
-- Recreates find_mixes_for_set_context with an optional p_genre_hint parameter
-- so the Hive Composer can filter suggestions by genre (Phase 12 filter chips).
--
-- mood values: 'peak', 'groove', 'ambient', 'transition' (nullable; set by upload processor)
-- energy: 0.0-1.0 (nullable; set by audio analysis pipeline)
--
-- Resolves: Phase 12 docs 45 §3, 46 §2.1

begin;

alter table public.audio_features
  add column if not exists mood   text,
  add column if not exists energy float;

-- Drop the old 4-param signature before recreating with 5 params
drop function if exists public.find_mixes_for_set_context(vector, int, int, int);

create or replace function public.find_mixes_for_set_context(
  p_embedding  vector(1536),
  p_bpm_min    int    default 0,
  p_bpm_max    int    default 999,
  p_k          int    default 10,
  p_genre_hint text   default null
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
    and (p_genre_hint is null or lower(m.genre) = lower(p_genre_hint))
  order by ae.embedding <=> p_embedding
  limit p_k;
end;
$$;

revoke execute on function find_mixes_for_set_context from public;
grant execute on function find_mixes_for_set_context to authenticated, service_role;

commit;
