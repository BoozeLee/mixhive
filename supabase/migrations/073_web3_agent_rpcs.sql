-- Migration 073: Web3 read-only RPCs for Lua agents
--
-- Exposes 4 security-definer RPCs that the Lua agent runtime calls via
-- mh.web3_* functions (doc 38 §1). All are read-only; no agent can write
-- on-chain state through these functions.
--
-- Adapted to the existing nft_collections schema (mix_id/quest_id/event_node_id
-- columns, not source_type/source_id) and existing nft_tokens schema.
--
-- Resolves: Phase 9 doc 38 §1 — Lua agent web3 read APIs

begin;

-- ── 1. agent_web3_get_pass_count ─────────────────────────────────────────────
-- Returns total confirmed token count across all live collections for a mix.

drop function if exists public.agent_web3_get_pass_count(uuid);

create or replace function public.agent_web3_get_pass_count(p_mix_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select count(t.id)::int
      from public.nft_collections c
      join public.nft_tokens t on t.collection_id = c.id
      where c.mix_id = p_mix_id
        and c.status in ('live', 'deploying')
    ),
    0
  );
$$;

revoke execute on function public.agent_web3_get_pass_count(uuid) from public;
grant execute on function public.agent_web3_get_pass_count(uuid) to authenticated, service_role;

-- ── 2. agent_web3_get_quest_backers ──────────────────────────────────────────
-- Returns total confirmed token count across all live collections for a quest.

drop function if exists public.agent_web3_get_quest_backers(uuid);

create or replace function public.agent_web3_get_quest_backers(p_quest_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select count(t.id)::int
      from public.nft_collections c
      join public.nft_tokens t on t.collection_id = c.id
      where c.quest_id = p_quest_id
        and c.status in ('live', 'deploying')
    ),
    0
  );
$$;

revoke execute on function public.agent_web3_get_quest_backers(uuid) from public;
grant execute on function public.agent_web3_get_quest_backers(uuid) to authenticated, service_role;

-- ── 3. agent_web3_get_supporter_history ─────────────────────────────────────
-- Returns a creator's own collection history, most recent first.
-- source_type is derived from which FK column is set.

drop function if exists public.agent_web3_get_supporter_history(uuid, int);

create or replace function public.agent_web3_get_supporter_history(
  p_owner_id uuid,
  p_limit    int default 10
)
returns table (
  collection_id uuid,
  source_type   text,
  source_id     uuid,
  minted_at     timestamptz,
  holder_count  int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id                                                  as collection_id,
    case
      when c.mix_id is not null        then 'mix'
      when c.quest_id is not null      then 'quest'
      when c.event_node_id is not null then 'gig'
      else                                  'unknown'
    end                                                   as source_type,
    coalesce(c.mix_id, c.quest_id, c.event_node_id)      as source_id,
    c.created_at                                          as minted_at,
    count(t.id)::int                                      as holder_count
  from public.nft_collections c
  left join public.nft_tokens t on t.collection_id = c.id
  where c.owner_id = p_owner_id
    and c.status in ('live', 'paused')
  group by c.id
  order by c.created_at desc
  limit p_limit;
$$;

revoke execute on function public.agent_web3_get_supporter_history(uuid, int) from public;
grant execute on function public.agent_web3_get_supporter_history(uuid, int) to authenticated, service_role;

-- ── 4. agent_web3_has_gig_proof ──────────────────────────────────────────────
-- Returns true if the given profile holds any soulbound gig/event proof token.

drop function if exists public.agent_web3_has_gig_proof(uuid);

create or replace function public.agent_web3_has_gig_proof(p_profile_id uuid)
returns bool
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.nft_tokens t
    join public.nft_collections c on c.id = t.collection_id
    where t.holder_profile = p_profile_id
      and c.event_node_id is not null
      and c.soulbound = true
  );
$$;

revoke execute on function public.agent_web3_has_gig_proof(uuid) from public;
grant execute on function public.agent_web3_has_gig_proof(uuid) to authenticated, service_role;

-- Resolves: Phase 9 doc 38 — agent_web3_* RPCs (4 functions)

commit;
