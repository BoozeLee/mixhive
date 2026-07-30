-- Migration 121: Flow Key FK-2 — germination
--
-- A spore is not an export, it is a seed. Germinating one re-opens it as new
-- living work and writes lineage back to its parent, so a mix descended from a
-- ritual shows up in the existing Yield Forensics causal trace
-- (trace_outcome_causation, migration 096) with no new UI — `inspired_by` is
-- already a type that walk follows.
--
-- Also completes the capability model 119 started: grants gain attenuated
-- delegation (a child grant can never exceed its parent's rights) and explicit
-- revocation that cascades down the chain.
--
-- Resolves: P7.5 FK-2

begin;

-- ── 1. Attenuated delegation on grants ──────────────────────────────────────

alter table public.flow_spore_grants
  add column if not exists parent_grant_id uuid references public.flow_spore_grants(id) on delete cascade;

create index if not exists flow_spore_grants_parent_idx
  on public.flow_spore_grants (parent_grant_id) where parent_grant_id is not null;

-- ── 2. flow_spore_germinations ──────────────────────────────────────────────

create table if not exists public.flow_spore_germinations (
  id               uuid primary key default gen_random_uuid(),
  spore_id         uuid not null references public.flow_spores(id) on delete cascade,
  germinated_by    uuid not null references public.profiles(id) on delete cascade,
  target           text not null check (target in ('beehive','mixhive_session','mix_draft')),
  child_session_id uuid references public.collab_sessions(id) on delete set null,
  child_mix_id     uuid references public.mixes(id) on delete set null,
  child_spore_id   uuid references public.flow_spores(id) on delete set null,
  edge_id          uuid references public.mythic_edges(id) on delete set null,
  created_at       timestamptz not null default now()
);

create index if not exists flow_spore_germinations_spore_idx
  on public.flow_spore_germinations (spore_id, created_at desc);
create index if not exists flow_spore_germinations_by_idx
  on public.flow_spore_germinations (germinated_by, created_at desc);

alter table public.flow_spore_germinations enable row level security;

drop policy if exists "germinations visible to germinator and spore owner" on public.flow_spore_germinations;
create policy "germinations visible to germinator and spore owner"
  on public.flow_spore_germinations for select
  using (
    germinated_by = auth.uid()
    or exists (
      select 1 from public.flow_spores s
      where s.id = flow_spore_germinations.spore_id and s.turned_by = auth.uid()
    )
  );

-- ── 3. can_germinate_flow_spore ─────────────────────────────────────────────
-- Ownership, contribution, or an unrevoked unexpired grant carrying 'germinate'.
-- People who made the thing never need a grant to re-open it.

create or replace function public.can_germinate_flow_spore(p_spore_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.flow_spores s
     where s.id = p_spore_id
       and s.state = 'sealed'
       and (
         s.turned_by = auth.uid()
         or exists (
           select 1 from public.flow_spore_contributors c
           where c.spore_id = s.id and c.profile_id = auth.uid()
         )
         or exists (
           select 1 from public.flow_spore_grants g
           where g.spore_id = s.id
             and g.grantee_profile = auth.uid()
             and 'germinate' = any(g.rights)
             and g.revoked_at is null
             and g.expires_at > now()
         )
       )
  );
$$;

comment on function public.can_germinate_flow_spore(uuid) is
  'True when the caller may germinate a sealed spore: they turned it, contributed to it, or hold an unrevoked unexpired grant carrying germinate. Contributors never need a grant to re-open their own work.';

-- ── 4. germinate_flow_spore ─────────────────────────────────────────────────
-- Writes the germination row plus a pre-approved inspired_by edge from the
-- child artefact back to the parent spore, mirroring record_milestone_outcome
-- (096). mythic_edges is SELECT-only to clients, so this must be the only path.

create or replace function public.germinate_flow_spore(
  p_spore_id uuid,
  p_target text,
  p_child_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_spore public.flow_spores%rowtype;
  v_spore_node uuid;
  v_child_node uuid;
  v_edge_id uuid;
  v_germination_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if p_target not in ('beehive','mixhive_session','mix_draft') then
    raise exception 'Unknown germination target: %', p_target using errcode = '22023';
  end if;

  select * into v_spore from public.flow_spores where id = p_spore_id;
  if v_spore.id is null then
    raise exception 'Spore not found' using errcode = 'P0002';
  end if;
  if v_spore.state <> 'sealed' then
    raise exception 'Spore is not sealed' using errcode = 'P0002';
  end if;
  if not public.can_germinate_flow_spore(p_spore_id) then
    raise exception 'Not authorized to germinate this spore' using errcode = '42501';
  end if;

  -- The spore's own graph node, created lazily on first germination.
  select id into v_spore_node
    from public.mythic_nodes
   where node_type = 'flow_spore'
     and source_table = 'flow_spores'
     and source_id = p_spore_id::text;

  if v_spore_node is null then
    insert into public.mythic_nodes (node_type, owner_id, source_table, source_id, title, payload)
    values (
      'flow_spore', v_spore.turned_by, 'flow_spores', p_spore_id::text,
      'Spore ' || left(coalesce(v_spore.content_hash, p_spore_id::text), 12),
      jsonb_build_object(
        'content_hash', v_spore.content_hash,
        'generation', v_spore.generation,
        'session_id', v_spore.session_id
      )
    )
    returning id into v_spore_node;
  end if;

  -- Lineage: child -> parent spore. inspired_by is deliberate — it is a type
  -- trace_outcome_causation already walks, so descended work appears in Yield
  -- Forensics with no new UI.
  if p_child_id is not null then
    select id into v_child_node
      from public.mythic_nodes
     where source_id = p_child_id::text
     limit 1;
  end if;

  if v_child_node is not null then
    insert into public.mythic_edges (
      from_node_id, to_node_id, edge_type, weight, occurred_at, metadata, source_event
    )
    values (
      v_child_node, v_spore_node, 'inspired_by', 1.0, now(),
      jsonb_build_object(
        'status', 'approved',
        'approved_by_user', true,
        'target', p_target,
        'parent_hash', v_spore.content_hash,
        'generation', v_spore.generation,
        'source', 'flow_key_germination'
      ),
      'user_action:germinate_spore:' || p_spore_id::text
    )
    returning id into v_edge_id;
  end if;

  insert into public.flow_spore_germinations (
    spore_id, germinated_by, target,
    child_session_id, child_mix_id, edge_id
  )
  values (
    p_spore_id, v_uid, p_target,
    case when p_target = 'mixhive_session' then p_child_id end,
    case when p_target = 'mix_draft' then p_child_id end,
    v_edge_id
  )
  returning id into v_germination_id;

  return jsonb_build_object(
    'germination_id', v_germination_id,
    'edge_id', v_edge_id,
    'spore_node_id', v_spore_node,
    'generation', v_spore.generation + 1,
    'parent_hash', v_spore.content_hash
  );
end;
$$;

comment on function public.germinate_flow_spore(uuid, text, uuid) is
  'Re-opens a sealed spore as new work and records lineage: writes a flow_spore_germinations row plus a pre-approved inspired_by edge from the child artefact to the spore node, so descended work appears in trace_outcome_causation.';

revoke all on function public.germinate_flow_spore(uuid, text, uuid) from anon;
grant execute on function public.germinate_flow_spore(uuid, text, uuid) to authenticated;
grant execute on function public.can_germinate_flow_spore(uuid) to authenticated;

-- ── 5. Attenuated delegation + cascading revocation ─────────────────────────

create or replace function public.delegate_flow_spore_grant(
  p_parent_grant_id uuid,
  p_grantee uuid,
  p_rights text[],
  p_token_hash text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent public.flow_spore_grants%rowtype;
  v_id uuid;
begin
  select * into v_parent from public.flow_spore_grants where id = p_parent_grant_id;
  if v_parent.id is null then
    raise exception 'Parent grant not found' using errcode = 'P0002';
  end if;
  if v_parent.issued_by <> auth.uid() and v_parent.grantee_profile <> auth.uid() then
    raise exception 'Not authorized to delegate this grant' using errcode = '42501';
  end if;
  if v_parent.revoked_at is not null or v_parent.expires_at <= now() then
    raise exception 'Parent grant is revoked or expired' using errcode = '42501';
  end if;

  -- Attenuation: a child may never carry a right its parent lacks, nor outlive it.
  if not (p_rights <@ v_parent.rights) then
    raise exception 'Cannot delegate rights the parent grant does not hold'
      using errcode = '42501';
  end if;

  insert into public.flow_spore_grants (
    spore_id, issued_by, grantee_profile, rights,
    parent_grant_id, token_hash, expires_at
  )
  values (
    v_parent.spore_id, auth.uid(), p_grantee, p_rights,
    p_parent_grant_id, p_token_hash, least(p_expires_at, v_parent.expires_at)
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.delegate_flow_spore_grant(uuid, uuid, text[], text, timestamptz) is
  'Issues an attenuated child grant: never more rights than its parent, never a later expiry. Revoking any ancestor kills the whole chain.';

create or replace function public.revoke_flow_spore_grant(p_grant_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not exists (
    select 1 from public.flow_spore_grants g
     where g.id = p_grant_id and g.issued_by = auth.uid()
  ) then
    raise exception 'Not authorized to revoke this grant' using errcode = '42501';
  end if;

  -- Revoke the grant and every descendant of it.
  with recursive chain as (
    select id from public.flow_spore_grants where id = p_grant_id
    union all
    select g.id from public.flow_spore_grants g
      join chain c on g.parent_grant_id = c.id
  )
  update public.flow_spore_grants
     set revoked_at = now()
   where id in (select id from chain) and revoked_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.revoke_flow_spore_grant(uuid) is
  'Revokes a grant and every grant delegated beneath it, in one statement. Returns how many were revoked.';

revoke all on function public.delegate_flow_spore_grant(uuid, uuid, text[], text, timestamptz) from anon;
revoke all on function public.revoke_flow_spore_grant(uuid) from anon;
grant execute on function public.delegate_flow_spore_grant(uuid, uuid, text[], text, timestamptz) to authenticated;
grant execute on function public.revoke_flow_spore_grant(uuid) to authenticated;

commit;

-- Resolves: P7.5 FK-2 (germination + attenuated capability grants)
