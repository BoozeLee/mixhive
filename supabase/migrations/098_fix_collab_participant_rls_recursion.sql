-- Fix legacy collab participant RLS recursion exposed by P7 public audiences.
-- The old policies queried collab_session_participants from inside that table's
-- own SELECT policy. Resolve membership through a SECURITY DEFINER helper.

begin;

create or replace function public.is_collab_session_participant(
  p_session_id uuid,
  p_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.collab_session_participants
    where session_id = p_session_id and profile_id = p_profile_id
  );
$$;

revoke execute on function public.is_collab_session_participant(uuid, uuid) from public, anon;
grant execute on function public.is_collab_session_participant(uuid, uuid) to authenticated;

drop policy if exists "collab_sessions_select" on public.collab_sessions;
create policy "collab_sessions_select"
  on public.collab_sessions for select
  using (
    owner_id = auth.uid()
    or is_public
    or public.is_collab_session_participant(id, auth.uid())
  );

drop policy if exists "collab_session_participants_select" on public.collab_session_participants;
create policy "collab_session_participants_select"
  on public.collab_session_participants for select
  using (
    profile_id = auth.uid()
    or public.is_collab_session_participant(session_id, auth.uid())
  );

commit;
