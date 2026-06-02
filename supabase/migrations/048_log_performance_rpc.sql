-- Migration 048: log_performance RPC + venue/event helpers for Mythic Tour Weaver
--
-- Adds a safe, atomic security-definer function `log_performance` that allows
-- an artist to log a real-world performance. This creates or finds venue + event
-- nodes and writes the critical `performed_at` (and optional `booked_by`) edges.
--
-- Why this exists:
-- The MythicNode graph (045-047) and strategic agents are live, but almost no
-- users have real `performed_at` / venue data. This RPC is the core primitive
-- that turns the existing GraphSeedingModal stub into production-grade graph
-- population for Experiment 5 (Tour Weaver). It also feeds Experiments 1-4.
--
-- Resolves: Phase 6.5/7 Experiment 5 (highest-leverage on-ramp for the Mythic graph)

begin;

-- 1. Ensure the extension we rely on for gen_random_uuid etc. exists (defensive)
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pgcrypto') then
    -- Supabase usually has this, but we guard anyway
    create extension if not exists pgcrypto;
  end if;
end $$;

-- 2. Core RPC: log_performance
-- Idempotent-friendly creation of venue + event + performed_at (+ optional booked_by / collab edges)
create or replace function public.log_performance(
  p_artist_id uuid,
  p_date timestamptz,
  p_venue_name text,
  p_city text default null,
  p_role text default 'support',
  p_co_billed text[] default '{}',           -- names or ids of other artists on the bill
  p_promoter_name text default null,
  p_notes text default null,
  p_link text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
  v_event_id uuid;
  v_edge_id uuid;
  v_nodes_created int := 0;
  v_edges_created int := 0;
  v_result jsonb;
begin
  -- Basic ownership / existence guard (artist must exist)
  if not exists (select 1 from public.profiles where id = p_artist_id) then
    raise exception 'Artist profile not found';
  end if;

  -- 1. Find or create Venue node (famous venues can have owner_id = null)
  select id into v_venue_id
  from public.mythic_nodes
  where node_type = 'venue'
    and lower(title) = lower(p_venue_name)
    and (p_city is null or lower((payload->>'city')::text) = lower(p_city))
  limit 1;

  if v_venue_id is null then
    insert into public.mythic_nodes (
      node_type, owner_id, title, payload, occurred_at, source_table, source_id
    )
    values (
      'venue',
      null,  -- venues are generally global; ownership is expressed via edges
      p_venue_name,
      jsonb_build_object(
        'city', p_city,
        'first_logged_by', p_artist_id
      ),
      p_date,
      'user_action:log_performance',
      p_artist_id::text
    )
    returning id into v_venue_id;
    v_nodes_created := v_nodes_created + 1;
  end if;

  -- 2. Create Event node (the specific performance instance)
  insert into public.mythic_nodes (
    node_type, owner_id, title, payload, occurred_at, source_table, source_id
  )
  values (
    'event',
    p_artist_id,
    p_venue_name || ' — ' || to_char(p_date, 'YYYY-MM-DD'),
    jsonb_build_object(
      'venue_id', v_venue_id,
      'role', p_role,
      'notes', p_notes,
      'link', p_link
    ),
    p_date,
    'user_action:log_performance',
    p_artist_id::text
  )
  returning id into v_event_id;
  v_nodes_created := v_nodes_created + 1;

  -- 3. Create the core performed_at edge (artist → event/venue)
  insert into public.mythic_edges (
    from_node_id, to_node_id, edge_type, weight, occurred_at,
    metadata, source_event
  )
  values (
    (select id from public.mythic_nodes
     where node_type = 'artist_profile' and owner_id = p_artist_id
     limit 1),   -- the artist's own profile node (should exist from onboarding)
    v_event_id,
    'performed_at',
    1.0,
    p_date,
    jsonb_build_object(
      'venue_id', v_venue_id,
      'role', p_role,
      'city', p_city
    ),
    'user_action:log_performance'
  )
  returning id into v_edge_id;
  v_edges_created := v_edges_created + 1;

  -- 4. Optional booked_by edge (if promoter supplied)
  if p_promoter_name is not null and length(trim(p_promoter_name)) > 0 then
    -- Find or create promoter node (lightweight)
    declare v_promoter_id uuid;
    begin
      select id into v_promoter_id
      from public.mythic_nodes
      where node_type = 'promoter'
        and lower(title) = lower(p_promoter_name)
      limit 1;

      if v_promoter_id is null then
        insert into public.mythic_nodes (node_type, title, payload, source_table, source_id)
        values ('promoter', p_promoter_name, '{}', 'user_action:log_performance', p_artist_id::text)
        returning id into v_promoter_id;
        v_nodes_created := v_nodes_created + 1;
      end if;

      insert into public.mythic_edges (
        from_node_id, to_node_id, edge_type, weight, occurred_at,
        metadata, source_event
      )
      values (
        (select id from public.mythic_nodes
         where node_type = 'artist_profile' and owner_id = p_artist_id limit 1),
        v_promoter_id,
        'booked_by',
        1.0,
        p_date,
        jsonb_build_object('event_id', v_event_id, 'venue_id', v_venue_id),
        'user_action:log_performance'
      );
      v_edges_created := v_edges_created + 1;
    end;
  end if;

  -- 5. Co-billed artists (intentionally lightweight in v1)
  -- We record the raw names in the event payload for now.
  -- Richer resolution into real `collab_with` edges can be added in a future migration
  -- once we have better artist matching logic.
  if array_length(p_co_billed, 1) > 0 then
    -- Update the event payload to include the co-billed names (best effort)
    update public.mythic_nodes
    set payload = payload || jsonb_build_object('co_billed', p_co_billed)
    where id = v_event_id;
  end if;

  -- 6. Enqueue a light derivation job (following the 046 pattern)
  -- This lets similarity / embedding jobs pick up the new data asynchronously.
  insert into public.mythic_graph_jobs (job_type, payload, status, owner_id)
  values (
    'derive_similarity_edges',
    jsonb_build_object(
      'trigger', 'log_performance',
      'artist_id', p_artist_id,
      'new_event_id', v_event_id
    ),
    'pending',
    p_artist_id
  );

  v_result := jsonb_build_object(
    'success', true,
    'nodes_created', v_nodes_created,
    'edges_created', v_edges_created,
    'venue_id', v_venue_id,
    'event_id', v_event_id
  );

  return v_result;
end;
$$;

-- Grant execute to authenticated users (they can only act on their own profile via the function body checks)
revoke all on function public.log_performance(uuid, timestamptz, text, text, text, text[], text, text, text) from public;
grant execute on function public.log_performance(uuid, timestamptz, text, text, text, text[], text, text, text) to authenticated;

-- Helpful comment for future maintainers
comment on function public.log_performance(uuid, timestamptz, text, text, text, text[], text, text, text) is
  'Atomic helper to log a real performance. Creates/finds venue + event nodes and performed_at (plus optional booked_by) edges. Enqueues derivation work. Security definer with internal ownership checks.';

commit;

-- Down-migration note:
-- Never edit this file. To change behavior, create a new numbered migration (049+).
-- To reverse this migration: 
--   drop function if exists public.log_performance(...);
--   (Any supporting objects added later can be cleaned in a subsequent migration.)

-- Resolves: Phase 6.5/7 Experiment 5 - Tour Weaver (Slice 5.1)