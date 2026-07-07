-- Migration 104: AI agents as artists
--
-- WHY: promote AI band members from rows in `mix_agent_credits` into first-class,
-- followable entities with a public artist page. Agents are shared cultural
-- entities keyed by slug, auto-created when a track is published with credits.
--
-- Builds on migration 103 (mix_agent_credits + publish_mix_with_credits RPC).

begin;

-- 1. Canonical agent entity. CHECK constraints keep inserts to valid, bounded
-- (slug, name) pairs even though inserts are open (shared, append-only entity).
create table if not exists public.ai_agents (
  slug text primary key check (slug ~ '^[a-z0-9-]+$' and char_length(slug) between 1 and 80),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);

alter table public.ai_agents enable row level security;

-- Public read; authenticated insert (agents are append-only shared entities,
-- created as a side effect of publishing). No client update/delete.
-- NOTE (follow-up): inserts are open to any authenticated user; the worst case is
-- a spurious agent row with no credits (never surfaces). Tighten with rate limits
-- or a security-definer-only path if spam appears.
drop policy if exists "ai_agents public read" on public.ai_agents;
create policy "ai_agents public read" on public.ai_agents for select using (true);

drop policy if exists "ai_agents authenticated insert" on public.ai_agents;
create policy "ai_agents authenticated insert" on public.ai_agents
  for insert to authenticated with check (true);

-- 2. Follows: a profile follows an agent-artist.
create table if not exists public.ai_agent_follows (
  agent_slug text not null references public.ai_agents(slug) on delete cascade,
  follower_profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (agent_slug, follower_profile_id)
);

create index if not exists idx_ai_agent_follows_slug on public.ai_agent_follows(agent_slug);

alter table public.ai_agent_follows enable row level security;

drop policy if exists "ai_agent_follows public read" on public.ai_agent_follows;
create policy "ai_agent_follows public read" on public.ai_agent_follows for select using (true);

drop policy if exists "ai_agent_follows owner write" on public.ai_agent_follows;
create policy "ai_agent_follows owner write" on public.ai_agent_follows
  for insert to authenticated with check (follower_profile_id = auth.uid());

drop policy if exists "ai_agent_follows owner delete" on public.ai_agent_follows;
create policy "ai_agent_follows owner delete" on public.ai_agent_follows
  for delete to authenticated using (follower_profile_id = auth.uid());

-- 3. Extend the publish RPC: upsert each credited agent into ai_agents so agents
-- gain identity automatically on publish (idempotent via on conflict).
create or replace function public.publish_mix_with_credits(p_mix jsonb, p_credits jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_mix_id uuid;
  v_has_credits boolean := jsonb_typeof(coalesce(p_credits, '[]'::jsonb)) = 'array'
    and jsonb_array_length(coalesce(p_credits, '[]'::jsonb)) > 0;
begin
  insert into public.mixes (
    dj_id, title, description, audio_url, duration_seconds, genre_id, tags,
    platform_links, is_explicit, ai_band
  ) values (
    auth.uid(),
    p_mix->>'title',
    nullif(p_mix->>'description', ''),
    p_mix->>'audio_url',
    nullif(p_mix->>'duration_seconds', '')::int,
    nullif(p_mix->>'genre_id', '')::int,
    case when jsonb_typeof(p_mix->'tags') = 'array'
      then array(select jsonb_array_elements_text(p_mix->'tags')) else null end,
    coalesce(p_mix->'platform_links', '{}'::jsonb),
    coalesce((p_mix->>'is_explicit')::boolean, false),
    v_has_credits
  )
  returning id into v_mix_id;

  if v_has_credits then
    -- Agents become first-class entities (shared, keyed by slug).
    insert into public.ai_agents (slug, name)
    select distinct on (c->>'agent_slug') c->>'agent_slug', c->>'agent_name'
    from jsonb_array_elements(p_credits) as c
    where coalesce(c->>'agent_slug', '') <> ''
    on conflict (slug) do nothing;

    insert into public.mix_agent_credits
      (mix_id, agent_slug, agent_name, agent_role, contribution, model, ord)
    select
      v_mix_id,
      c->>'agent_slug',
      c->>'agent_name',
      nullif(c->>'agent_role', ''),
      nullif(c->>'contribution', ''),
      nullif(c->>'model', ''),
      (n - 1)::int
    from jsonb_array_elements(p_credits) with ordinality as t(c, n);
  end if;

  return v_mix_id;
end;
$$;

commit;
