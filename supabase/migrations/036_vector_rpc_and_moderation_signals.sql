-- Migration 036: match_ai_embeddings RPC + moderation_signals table
--
-- Adds two missing pieces for the Lua agent runtime:
-- 1. match_ai_embeddings() — cosine similarity search over ai_embeddings,
--    called by vector.ts via supabase.rpc(). Security-definer so agents
--    can search without needing direct table access from the client.
-- 2. moderation_signals — append-only table for the moderation agent to
--    record flagged content. Service-role only; no client RLS policies.
--
-- Requires: pgvector extension (enabled in migration 030)
--
-- Resolves: Lua agent vector.search runtime 404 + moderation agent write errors

begin;

-- ── 1. match_ai_embeddings RPC ──────────────────────────────────────────────

create or replace function match_ai_embeddings(
  query_embedding    vector(1536),
  match_threshold    float  default 0.5,
  match_count        int    default 10,
  filter_entity_type text   default null
)
returns table (
  id          uuid,
  owner_id    uuid,
  entity_type text,
  entity_id   uuid,
  entity_key  text,
  metadata    jsonb,
  similarity  float
)
language sql stable security definer
set search_path = public
as $$
  select
    ae.id,
    ae.owner_id,
    ae.entity_type,
    ae.entity_id,
    ae.entity_key,
    ae.metadata,
    1 - (ae.embedding <=> query_embedding) as similarity
  from   ai_embeddings ae
  where  (filter_entity_type is null or ae.entity_type = filter_entity_type)
    and  1 - (ae.embedding <=> query_embedding) > match_threshold
  order  by ae.embedding <=> query_embedding
  limit  match_count;
$$;

-- Restrict to service-role; agents call this server-side only
revoke execute on function match_ai_embeddings(vector, float, int, text) from public;

-- ── 2. moderation_signals ────────────────────────────────────────────────────

create table if not exists moderation_signals (
  id           uuid        primary key default gen_random_uuid(),
  source_table text        not null,
  source_id    uuid,
  signal_type  text        not null,  -- 'hate_speech'|'fraud'|'doxxing'|'csam'|'violent_threat'
  severity     text        not null,  -- 'low'|'medium'|'high'|'critical'
  action_taken text,                  -- 'flagged'|'hidden'|'banned'|'escalated'
  flagged_by   text        not null default 'moderation_agent',
  payload      jsonb       not null default '{}',
  created_at   timestamptz not null default now()
);

alter table moderation_signals enable row level security;
-- No client policies — moderation signals are service-role only

create index if not exists moderation_signals_source_idx
  on moderation_signals (source_table, source_id);

create index if not exists moderation_signals_severity_idx
  on moderation_signals (severity, created_at desc);

commit;
