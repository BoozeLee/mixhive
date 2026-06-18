-- Migration 103: AI Band — agent provenance for tracks
--
-- WHY: a published track records nothing about the AI agents that co-produced
-- it. This adds per-track agent credits ("AI band members"), a cheap denormalized
-- `mixes.ai_band` flag for badges/filters, and an atomic publish RPC so the mix
-- row + its credits + the flag are written together (no partial state).
--
-- Source-agnostic: not tied to Beehive Studio. Resolves: AI Band provenance.

begin;

-- 1. Per-track agent credits.
create table if not exists public.mix_agent_credits (
  id uuid primary key default gen_random_uuid(),
  mix_id uuid not null references public.mixes(id) on delete cascade,
  agent_slug text not null,
  agent_name text not null,
  agent_role text,
  contribution text,
  model text,
  ord int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_mix_agent_credits_mix on public.mix_agent_credits(mix_id);
create index if not exists idx_mix_agent_credits_slug on public.mix_agent_credits(agent_slug);

alter table public.mix_agent_credits enable row level security;

-- Public read; insert only when the parent mix belongs to the caller. No client
-- update; deletes cascade with the mix (no direct client delete policy).
drop policy if exists "mix_agent_credits public read" on public.mix_agent_credits;
create policy "mix_agent_credits public read" on public.mix_agent_credits
  for select using (true);

drop policy if exists "mix_agent_credits owner insert" on public.mix_agent_credits;
create policy "mix_agent_credits owner insert" on public.mix_agent_credits
  for insert to authenticated
  with check (exists (
    select 1 from public.mixes m where m.id = mix_id and m.dj_id = auth.uid()
  ));

-- 2. Cheap denormalized flag for badges / list filtering.
alter table public.mixes add column if not exists ai_band boolean not null default false;

-- 3. Atomic publish RPC: insert the mix row + its agent credits + set ai_band in
-- one call. SECURITY INVOKER so RLS and auth.uid() apply to the caller (dj_id is
-- always forced to auth.uid(), never trusted from the payload).
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
