-- Migration 030: AI embeddings and recommendation scores.
--
-- This completes the first AI infrastructure foundation slice from the
-- MIXHIVE master plan. Embeddings are intentionally not readable by clients;
-- recommendation scores are owner-scoped and explainable.

begin;

create extension if not exists vector;

create table if not exists ai_embeddings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  entity_key text,
  embedding vector(1536),
  model text not null default 'text-embedding-3-small',
  version int not null default 1,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  check (entity_id is not null or entity_key is not null)
);

create index if not exists ai_embeddings_entity_idx
  on ai_embeddings (entity_type, entity_id);

alter table ai_embeddings enable row level security;

-- No client policies on purpose. Reads/writes should go through server-side
-- service-role functions or future Edge Functions that enforce ownership.
drop policy if exists "ai_embeddings_no_client_access" on ai_embeddings;

create table if not exists recommendation_scores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  target_type text not null,
  target_id uuid,
  target_key text,
  score numeric(5,2) not null default 0 check (score >= 0 and score <= 100),
  rationale text,
  model text,
  version int not null default 1,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  check (target_id is not null or target_key is not null)
);

create index if not exists recommendation_scores_owner_target_idx
  on recommendation_scores (owner_id, target_type, score desc, created_at desc);

alter table recommendation_scores enable row level security;

drop policy if exists "recommendation_scores_owner_read" on recommendation_scores;
create policy "recommendation_scores_owner_read" on recommendation_scores
  for select
  using (auth.uid() = owner_id);

drop policy if exists "recommendation_scores_owner_feedback_update" on recommendation_scores;
create policy "recommendation_scores_owner_feedback_update" on recommendation_scores
  for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

commit;
