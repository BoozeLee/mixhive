-- Migration 122: Flow Key Layer B (countersignatures) + Layer C (Merkle notary)
--
-- Layer B — the server's Ed25519 seal says "MixHive attests this spore was
-- drained from that ritual". A countersignature says what MixHive cannot say on
-- anyone's behalf: "I was in that room, and I say so, signed with a key only I
-- hold." Non-transferable by construction — a signature names its signer.
--
-- Layer C — anchoring each spore individually would cost gas proportional to
-- culture, which is backwards. A daily batch publishes one Merkle root over
-- every genome sealed that day; each spore carries an inclusion proof. One
-- transaction per day regardless of volume, and the proof verifies offline
-- against the published root with no chain access at all.
--
-- NOTHING HERE TOUCHES A CHAIN. Anchors are recorded off-chain by default;
-- `chain`, `tx_hash` and `attestation_uid` stay null until someone explicitly
-- anchors a batch. Per the spec, mainnet is gated to P14 and the default target
-- is Base Sepolia.
--
-- GDPR: the notary commits only to hashes. No personal data, no genome bodies,
-- no audio. Deleting a spore leaves the root committing to a preimage that no
-- longer exists — an orphan pointer, which is the desired end state.
--
-- Resolves: P7.5 FK-2 (Layer B) + FK-3 (Layer C)

begin;

-- ── 1. Countersignatures on contributors ────────────────────────────────────

alter table public.flow_spore_contributors
  add column if not exists wallet_address   text,
  add column if not exists countersignature text,
  add column if not exists countersigned_at timestamptz;

create index if not exists flow_spore_contributors_countersigned_idx
  on public.flow_spore_contributors (spore_id)
  where countersignature is not null;

-- Signature verification happens server-side with ethers (the same primitive as
-- SIWE wallet linkage); this only records an already-verified result, so it is
-- service-role only.
create or replace function public.record_flow_spore_countersignature(
  p_spore_id uuid,
  p_profile_id uuid,
  p_address text,
  p_signature text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  update public.flow_spore_contributors
     set wallet_address   = lower(p_address),
         countersignature = p_signature,
         countersigned_at = now()
   where spore_id = p_spore_id
     and profile_id = p_profile_id
     and fraction = 'carbon';

  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    raise exception 'Not a carbon contributor on this spore' using errcode = '42501';
  end if;

  return jsonb_build_object('countersigned', true, 'spore_id', p_spore_id);
end;
$$;

comment on function public.record_flow_spore_countersignature(uuid, uuid, text, text) is
  'Records an already-verified contributor countersignature. Verification happens server-side with ethers; this function trusts its caller and is service-role only.';

revoke all on function public.record_flow_spore_countersignature(uuid, uuid, text, text)
  from anon, authenticated;

-- ── 2. The notary ───────────────────────────────────────────────────────────

create table if not exists public.flow_spore_anchors (
  id              uuid primary key default gen_random_uuid(),
  batch_date      date not null unique,
  merkle_root     text not null,
  leaf_count      int not null check (leaf_count > 0),
  -- Null until someone anchors on chain. Off-chain is the default and is
  -- fully useful on its own.
  chain           text check (chain in ('base-sepolia','base')),
  tx_hash         text,
  attestation_uid text,
  anchored_at     timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists flow_spore_anchors_unanchored_idx
  on public.flow_spore_anchors (batch_date) where anchored_at is null;

alter table public.flow_spores
  add column if not exists anchor_id    uuid references public.flow_spore_anchors(id) on delete set null,
  add column if not exists merkle_proof jsonb;

create index if not exists flow_spores_anchor_idx
  on public.flow_spores (anchor_id) where anchor_id is not null;

-- Roots are public by design: a root nobody can read cannot notarise anything.
alter table public.flow_spore_anchors enable row level security;

drop policy if exists "anchors are public" on public.flow_spore_anchors;
create policy "anchors are public"
  on public.flow_spore_anchors for select
  using (true);

-- ── 3. Batch selection + recording ──────────────────────────────────────────

-- Sealed spores from a given day that are not yet in any batch, ordered
-- deterministically so the root is reproducible from the same inputs.
create or replace function public.flow_spores_awaiting_anchor(p_batch_date date)
returns table (id uuid, content_hash text)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.content_hash
    from public.flow_spores s
   where s.state = 'sealed'
     and s.content_hash is not null
     and s.anchor_id is null
     and s.sealed_at >= p_batch_date::timestamptz
     and s.sealed_at <  (p_batch_date + 1)::timestamptz
   order by s.content_hash;
$$;

create or replace function public.record_flow_spore_anchor(
  p_batch_date date,
  p_merkle_root text,
  p_leaf_count int,
  p_proofs jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anchor_id uuid;
begin
  insert into public.flow_spore_anchors (batch_date, merkle_root, leaf_count)
  values (p_batch_date, p_merkle_root, p_leaf_count)
  on conflict (batch_date) do update
    set merkle_root = excluded.merkle_root,
        leaf_count  = excluded.leaf_count
  returning id into v_anchor_id;

  -- p_proofs: [{"spore_id": "...", "proof": [...]}, ...]
  update public.flow_spores s
     set anchor_id    = v_anchor_id,
         merkle_proof = p.proof
    from (
      select (e->>'spore_id')::uuid as spore_id, e->'proof' as proof
        from jsonb_array_elements(coalesce(p_proofs, '[]'::jsonb)) as e
    ) p
   where s.id = p.spore_id;

  return v_anchor_id;
end;
$$;

comment on function public.record_flow_spore_anchor(date, text, int, jsonb) is
  'Records a daily Merkle root and writes each spore its inclusion proof. Idempotent per batch_date: re-running a batch replaces the root and re-stamps proofs.';

revoke all on function public.record_flow_spore_anchor(date, text, int, jsonb) from anon, authenticated;
grant execute on function public.flow_spores_awaiting_anchor(date) to authenticated;

commit;

-- Resolves: P7.5 FK-2 Layer B + FK-3 Layer C (off-chain notary; no chain writes)
