-- Fix the legacy collab end RPC's graph-job enqueue contract. The queue stores
-- job input in `scope`; migrations 050/097 incorrectly referenced removed
-- `payload` and `owner_id` columns.

begin;

create or replace function public.end_collab_session(p_session_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.collab_sessions
    where id = p_session_id and owner_id = auth.uid() and status = 'active'
  ) then raise exception 'Not authorized, session not found, or session already ended'; end if;

  update public.collab_session_state
  set anchor_position = case
        when playback_status = 'playing'
          then anchor_position + extract(epoch from (now() - anchor_timestamp))
        else anchor_position
      end,
      playback_status = 'paused',
      anchor_timestamp = now(),
      updated_by = auth.uid(),
      updated_at = now()
  where session_id = p_session_id;
  update public.collab_session_votes set status = 'closed'
  where session_id = p_session_id and status = 'open';
  update public.collab_sessions set status = 'ended', ended_at = now() where id = p_session_id;
  insert into public.collab_session_events(session_id, actor_id, event_type)
  values (p_session_id, auth.uid(), 'ritual_ended');
  insert into public.mythic_graph_jobs(job_type, scope, status)
  values (
    'collab_session_post_process',
    jsonb_build_object('session_id', p_session_id),
    'pending'
  );
end;
$$;

revoke execute on function public.end_collab_session(uuid) from public, anon;
grant execute on function public.end_collab_session(uuid) to authenticated;

commit;
