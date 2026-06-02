-- Migration 049: Artist Profile Node Auto-Creation + RPC Hardening
--
-- 1. Ensures that when a new profile is created (via existing handle_new_user trigger),
--    a corresponding mythic_nodes row of type 'artist_profile' is also created.
--    This solves the "Artist Profile Node Assumption" issue in performance logging.
--
-- 2. Hardens the log_performance RPC from migration 048 to be defensive:
--    - If the artist_profile mythic_node does not exist yet, it creates it on the fly.
--    - Safer handling for edge cases during early user lifecycle.
--
-- 3. Adds a one-time backfill helper for existing users (commented, run manually if needed).
--
-- Why: The Mythic graph depends on artist_profile nodes existing for performed_at edges
-- and agent reasoning. Relying only on manual GraphSeedingModal is fragile.
--
-- Resolves: Phase 6.5/7 Experiment 5 - Artist Profile Node Assumption + RPC robustness

begin;

-- ============================================
-- 1. Trigger: Auto-create artist_profile mythic node when profile is created
-- ============================================

create or replace function public.handle_new_artist_profile_node()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Create the canonical artist_profile node in the Mythic graph if it doesn't exist
  insert into public.mythic_nodes (
    node_type,
    owner_id,
    title,
    payload,
    source_table,
    source_id
  )
  values (
    'artist_profile',
    new.id,
    coalesce(new.display_name, new.username, 'Artist'),
    jsonb_build_object(
      'username', new.username,
      'display_name', new.display_name
    ),
    'profiles',
    new.id::text
  )
  on conflict (owner_id) where node_type = 'artist_profile' do nothing;

  return new;
end;
$$;

-- Attach trigger to profiles table (runs after the existing handle_new_user logic)
drop trigger if exists on_profile_created_create_mythic_node on public.profiles;
create trigger on_profile_created_create_mythic_node
  after insert on public.profiles
  for each row
  execute function public.handle_new_artist_profile_node();

-- ============================================
-- 2. Harden log_performance RPC (from 048)
-- ============================================

create or replace function public.log_performance(
  p_artist_id uuid,
  p_date timestamptz,
  p_venue_name text,
  p_city text default null,
  p_role text default 'support',
  p_co_billed text[] default '{}',
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
  v_artist_profile_node_id uuid;
  v_venue_id uuid;
  v_event_id uuid;
  v_nodes_created int := 0;
  v_edges_created int := 0;
  v_result jsonb;
begin
  -- Ensure artist exists
  if not exists (select 1 from public.profiles where id = p_artist_id) then
    raise exception 'Artist profile not found';
  end if;

  -- ============================================
  -- DEFENSIVE: Ensure artist_profile mythic node exists
  -- ============================================
  select id into v_artist_profile_node_id
  from public.mythic_nodes
  where node_type = 'artist_profile'
    and owner_id = p_artist_id
  limit 1;

  if v_artist_profile_node_id is null then
    -- Create it on the fly (idempotent)
    insert into public.mythic_nodes (
      node_type, owner_id, title, payload, source_table, source_id
    )
    values (
      'artist_profile',
      p_artist_id,
      (select coalesce(display_name, username, 'Artist') from public.profiles where id = p_artist_id),
      jsonb_build_object(
        'username', (select username from public.profiles where id = p_artist_id)
      ),
      'profiles',
      p_artist_id::text
    )
    returning id into v_artist_profile_node_id;

    v_nodes_created := v_nodes_created + 1;
  end if;

  -- 1. Find or create Venue node
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
      null,
      p_venue_name,
      jsonb_build_object('city', p_city, 'first_logged_by', p_artist_id),
      p_date,
      'user_action:log_performance',
      p_artist_id::text
    )
    returning id into v_venue_id;
    v_nodes_created := v_nodes_created + 1;
  end if;

  -- 2. Create Event node
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
      'link', p_link,
      'co_billed', p_co_billed
    ),
    p_date,
    'user_action:log_performance',
    p_artist_id::text
  )
  returning id into v_event_id;
  v_nodes_created := v_nodes_created + 1;

  -- 3. Create performed_at edge (using the guaranteed artist_profile node)
  insert into public.mythic_edges (
    from_node_id, to_node_id, edge_type, weight, occurred_at, metadata, source_event
  )
  values (
    v_artist_profile_node_id,
    v_event_id,
    'performed_at',
    1.0,
    p_date,
    jsonb_build_object('venue_id', v_venue_id, 'role', p_role, 'city', p_city),
    'user_action:log_performance'
  );
  v_edges_created := v_edges_created + 1;

  -- 4. Optional booked_by edge (promoter)
  if p_promoter_name is not null and length(trim(p_promoter_name)) > 0 then
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
        from_node_id, to_node_id, edge_type, weight, occurred_at, metadata, source_event
      )
      values (
        v_artist_profile_node_id,
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

  -- 5. Enqueue derivation job (same as 048)
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

-- Re-apply grants (idempotent)
revoke all on function public.log_performance(uuid, timestamptz, text, text, text, text[], text, text, text) from public;
grant execute on function public.log_performance(uuid, timestamptz, text, text, text, text[], text, text, text) to authenticated;

comment on function public.log_performance(uuid, timestamptz, text, text, text, text[], text, text, text) is
  'Hardened version (049). Auto-creates artist_profile mythic node if missing. Creates performance graph data atomically.';

-- ============================================
-- 3. Optional Backfill (commented - run manually in SQL editor if needed)
-- ============================================
/*
-- One-time backfill for existing profiles that don't have artist_profile nodes yet
DO $$
DECLARE
  prof RECORD;
BEGIN
  FOR prof IN
    SELECT p.id, p.username, p.display_name
    FROM public.profiles p
    LEFT JOIN public.mythic_nodes mn 
      ON mn.owner_id = p.id AND mn.node_type = 'artist_profile'
    WHERE mn.id IS NULL
  LOOP
    INSERT INTO public.mythic_nodes (node_type, owner_id, title, payload, source_table, source_id)
    VALUES (
      'artist_profile',
      prof.id,
      coalesce(prof.display_name, prof.username, 'Artist'),
      jsonb_build_object('username', prof.username),
      'profiles',
      prof.id::text
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
*/

commit;