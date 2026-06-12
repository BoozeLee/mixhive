-- Migration 096: Causal Career Loop — edge review + outcome attribution RPCs
--
-- mythic_edges has only a SELECT RLS policy (045), so authenticated clients
-- cannot write edges directly — every edge write must go through a
-- security-definer RPC (the pattern established by 048_log_performance_rpc).
-- This adds three such RPCs that close the "confirmation gate -> outcome ->
-- causal trace" loop:
--   1. set_proposal_status   — persist a user's approve/reject of a proposed edge
--                              (fixes the silently-failing client update in the
--                              ProposalsInbox / PostSessionReview UIs).
--   2. record_milestone_outcome — write a yielded_outcome edge and link it to the
--                              quest milestone it completed (completed_via_edge_id).
--   3. trace_outcome_causation — recursive backward walk returning the causal chain
--                              that led to an outcome, for the Yield Forensics UI.
--
-- Resolves: OMNINOVATOR Phase A.2 (Causal Career Loop) + A.1 write-fix

begin;

-- ── 1. set_proposal_status ────────────────────────────────────────────────────
create or replace function public.set_proposal_status(
  p_edge_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owned boolean;
begin
  if p_status not in ('approved', 'rejected') then
    raise exception 'Invalid status %, expected approved or rejected', p_status;
  end if;

  -- The caller must own a node on this edge.
  select exists (
    select 1
    from public.mythic_edges e
    join public.mythic_nodes n
      on n.id = e.from_node_id or n.id = e.to_node_id
    where e.id = p_edge_id
      and n.owner_id = auth.uid()
  ) into v_owned;

  if not v_owned then
    raise exception 'Edge not found or not owned by caller';
  end if;

  -- jsonb merge preserves existing metadata (rationale, session_title, …).
  update public.mythic_edges
  set metadata = coalesce(metadata, '{}'::jsonb)
    || jsonb_build_object(
         'status', p_status,
         'reviewed_at', now(),
         'approved_by_user', p_status = 'approved'
       )
  where id = p_edge_id;

  return jsonb_build_object('success', true, 'edge_id', p_edge_id, 'status', p_status);
end;
$$;

revoke all on function public.set_proposal_status(uuid, text) from public;
grant execute on function public.set_proposal_status(uuid, text) to authenticated;

comment on function public.set_proposal_status(uuid, text) is
  'Persist a user''s approve/reject decision on a proposed mythic edge. Security definer with an ownership check; only mutates metadata.status. Replaces the RLS-denied client-side update.';

-- ── 2. record_milestone_outcome ───────────────────────────────────────────────
create or replace function public.record_milestone_outcome(
  p_milestone_id uuid,
  p_outcome_node_id uuid,
  p_outcome_type text default null,
  p_rationale text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_quest_owned boolean;
  v_artist_id uuid;
  v_edge_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  -- The milestone must belong to a quest owned by the caller.
  select exists (
    select 1
    from public.quest_milestones m
    join public.quests q on q.id = m.quest_id
    where m.id = p_milestone_id
      and q.owner_id = v_uid
  ) into v_quest_owned;

  if not v_quest_owned then
    raise exception 'Milestone not found or not owned by caller';
  end if;

  -- The outcome node must be readable: owned by the caller or globally public.
  if not exists (
    select 1 from public.mythic_nodes n
    where n.id = p_outcome_node_id
      and (n.owner_id = v_uid or n.owner_id is null)
  ) then
    raise exception 'Outcome node not found or not accessible';
  end if;

  -- Resolve (or create) the caller's artist node.
  select id into v_artist_id
  from public.mythic_nodes
  where node_type = 'artist_profile'
    and owner_id = v_uid
  order by created_at
  limit 1;

  if v_artist_id is null then
    insert into public.mythic_nodes (node_type, owner_id, source_table, source_id, title)
    select 'artist_profile', v_uid, 'profiles', v_uid::text,
           coalesce(p.display_name, p.username, 'You')
    from public.profiles p
    where p.id = v_uid
    returning id into v_artist_id;
  end if;

  -- Write the yielded_outcome edge (artist -> outcome), pre-approved (user action).
  insert into public.mythic_edges (
    from_node_id, to_node_id, edge_type, weight, occurred_at, metadata, source_event
  )
  values (
    v_artist_id,
    p_outcome_node_id,
    'yielded_outcome',
    1.0,
    now(),
    jsonb_build_object(
      'status', 'approved',
      'approved_by_user', true,
      'outcome_type', p_outcome_type,
      'rationale', p_rationale,
      'source', 'milestone'
    ),
    'user_action:record_outcome'
  )
  returning id into v_edge_id;

  -- Link the milestone to the edge that completed it, and close it out.
  update public.quest_milestones
  set status = 'completed',
      completed_at = now(),
      completed_via_edge_id = v_edge_id
  where id = p_milestone_id;

  return jsonb_build_object('success', true, 'edge_id', v_edge_id, 'artist_id', v_artist_id);
end;
$$;

revoke all on function public.record_milestone_outcome(uuid, uuid, text, text) from public;
grant execute on function public.record_milestone_outcome(uuid, uuid, text, text) to authenticated;

comment on function public.record_milestone_outcome(uuid, uuid, text, text) is
  'Atomically records a yielded_outcome edge from the caller''s artist node to an outcome node and links it to the completed quest milestone (completed_via_edge_id). Security definer with ownership checks.';

-- ── 3. trace_outcome_causation ────────────────────────────────────────────────
create or replace function public.trace_outcome_causation(
  p_outcome_edge_id uuid,
  p_max_depth int default 5
)
returns table (
  depth int,
  edge_id uuid,
  edge_type text,
  from_node_id uuid,
  from_title text,
  from_type text,
  to_node_id uuid,
  to_title text,
  to_type text,
  occurred_at timestamptz,
  metadata jsonb,
  source_event text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_from uuid;
  v_to uuid;
  v_depth int := greatest(1, least(coalesce(p_max_depth, 5), 8));
begin
  -- Anchor on the outcome edge and verify the caller owns one of its nodes.
  select e.from_node_id, e.to_node_id into v_from, v_to
  from public.mythic_edges e
  join public.mythic_nodes n
    on n.id = e.from_node_id or n.id = e.to_node_id
  where e.id = p_outcome_edge_id
    and n.owner_id = v_uid
  limit 1;

  if v_from is null then
    return; -- not found or not owned: empty chain
  end if;

  return query
  with recursive chain as (
    -- Seed: predecessor edges touching either endpoint of the outcome.
    select e.id, e.from_node_id, e.to_node_id, e.edge_type, e.occurred_at,
           e.metadata, e.source_event, 1 as depth, array[e.id] as path
    from public.mythic_edges e
    where e.id <> p_outcome_edge_id
      and e.edge_type <> 'yielded_outcome'
      and (e.from_node_id in (v_from, v_to) or e.to_node_id in (v_from, v_to))
    union all
    select e.id, e.from_node_id, e.to_node_id, e.edge_type, e.occurred_at,
           e.metadata, e.source_event, c.depth + 1, c.path || e.id
    from public.mythic_edges e
    join chain c
      on (e.from_node_id in (c.from_node_id, c.to_node_id)
          or e.to_node_id in (c.from_node_id, c.to_node_id))
    where c.depth < v_depth
      and e.edge_type <> 'yielded_outcome'
      and not (e.id = any(c.path)) -- cycle guard
  ),
  deduped as (
    select distinct on (id) id, from_node_id, to_node_id, edge_type,
           occurred_at, metadata, source_event, depth
    from chain
    order by id, depth
  )
  select d.depth, d.id, d.edge_type,
         d.from_node_id, fn.title, fn.node_type,
         d.to_node_id, tn.title, tn.node_type,
         d.occurred_at, d.metadata, d.source_event
  from deduped d
  join public.mythic_nodes fn on fn.id = d.from_node_id
  join public.mythic_nodes tn on tn.id = d.to_node_id
  order by d.occurred_at asc nulls last, d.depth asc;
end;
$$;

revoke all on function public.trace_outcome_causation(uuid, int) from public;
grant execute on function public.trace_outcome_causation(uuid, int) to authenticated;

comment on function public.trace_outcome_causation(uuid, int) is
  'Returns the causal chain (predecessor edges, bounded recursive walk with cycle guard) that led to a yielded_outcome edge. Security definer with an ownership check on the anchor edge.';

commit;

-- Down-migration note: never edit this file. To reverse, add a later migration that
-- drops public.set_proposal_status / record_milestone_outcome / trace_outcome_causation.

-- Resolves: OMNINOVATOR Phase A.2 (Causal Career Loop) + A.1 write-fix
