-- Migration 123: the host cap override
--
-- The capping predicate (src/lib/flow-key/capping.ts) has always honoured a
-- `flow_key_cap` event as the one way to drain the take currently playing —
-- "the override that lets you drain the thing you just finished". Nothing ever
-- emitted that event, so the path was designed but unreachable. This closes it.
--
-- Host-only, and deliberately an RPC rather than a direct insert: clients can
-- write collab_session_events for themselves (097 policy), so leaving this to
-- the client would let any participant cap the live take and pull it into a
-- harvest. Capping is the one moment the "uncapped is never harvested" rule
-- bends, so only the host may bend it.
--
-- Uncapping is supported too — the host can change their mind while the drain
-- is still closed.
--
-- Resolves: P7.5 FK-1 (host cap override)

begin;

create or replace function public.cap_flow_key_cell(
  p_session_id uuid,
  p_asset_id uuid,
  p_capped boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asset_name text;
begin
  if not public.can_manage_collab_session(p_session_id) then
    raise exception 'Only creators can cap a cell' using errcode = '42501';
  end if;

  select name into v_asset_name
    from public.collab_session_assets
   where id = p_asset_id and session_id = p_session_id;

  if v_asset_name is null then
    raise exception 'Asset not found in this session' using errcode = 'P0002';
  end if;

  -- Capping while a drain is open would change what that drain harvests after
  -- the room already saw the key turn. The boundary must stay honest.
  if exists (
    select 1 from public.flow_key_taps
     where session_id = p_session_id and is_open
  ) then
    raise exception 'Cannot change capping while a drain is open'
      using errcode = '55006';
  end if;

  if p_capped then
    insert into public.collab_session_events (session_id, actor_id, event_type, payload)
    values (
      p_session_id, auth.uid(), 'flow_key_cap',
      jsonb_build_object('asset_id', p_asset_id, 'name', v_asset_name)
    );
  else
    -- Uncapping removes the prior cap events for this asset outright, so the
    -- predicate simply stops seeing it. Cheaper and clearer than a tombstone.
    delete from public.collab_session_events
     where session_id = p_session_id
       and event_type = 'flow_key_cap'
       and payload->>'asset_id' = p_asset_id::text;
  end if;

  return jsonb_build_object(
    'asset_id', p_asset_id,
    'name', v_asset_name,
    'capped', p_capped
  );
end;
$$;

comment on function public.cap_flow_key_cell(uuid, uuid, boolean) is
  'Host-only: marks a session asset as capped (or removes the mark), which is the sole way the currently-playing take becomes eligible to drain. Refuses while a drain is open so the snapshot boundary cannot shift under a harvest the room already witnessed.';

revoke all on function public.cap_flow_key_cell(uuid, uuid, boolean) from anon;
grant execute on function public.cap_flow_key_cell(uuid, uuid, boolean) to authenticated;

commit;

-- Resolves: P7.5 FK-1 host cap override
