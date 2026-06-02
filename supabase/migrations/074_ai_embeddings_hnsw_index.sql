-- Migration 074: HNSW index on ai_embeddings.embedding for fast cosine search
--
-- Requires pgvector ≥ 0.5.0 (Supabase supports HNSW since mid-2024).
-- m=16, ef_construction=64 is balanced for 100K+ vectors.
-- Set hnsw.ef_search=40 at query time for < 100ms p99 on the similarity RPCs.
-- Partial B-tree indexes on entity_id per entity_type improve query planning.
--
-- Resolves: Phase 10 doc 39 §6.1

begin;

create index if not exists idx_ai_embeddings_hnsw
  on public.ai_embeddings
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

create index if not exists idx_ai_embeddings_hnsw_mix
  on public.ai_embeddings (entity_id)
  where entity_type = 'mix';

create index if not exists idx_ai_embeddings_hnsw_profile
  on public.ai_embeddings (entity_id)
  where entity_type = 'profile';

create index if not exists idx_ai_embeddings_hnsw_scene
  on public.ai_embeddings (entity_id)
  where entity_type = 'scene';

create index if not exists idx_ai_embeddings_hnsw_venue
  on public.ai_embeddings (entity_id)
  where entity_type = 'venue';

create index if not exists idx_ai_embeddings_hnsw_snapshot
  on public.ai_embeddings (entity_id)
  where entity_type = 'profile_snapshot';

commit;
