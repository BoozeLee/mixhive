-- Migration 052: RLS Hardening for collab_sessions tables (Experiment 1)
--
-- Previous policies from 050 were a good start but too permissive,
-- especially around UPDATE and missing policies on the participants join table.
--
-- This migration adds stricter, clearer policies so that:
-- - Only actual participants can see a session.
-- - Only the owner can delete/end a session.
-- - Participants can only manage their own participation row.
-- - Public sessions are still readable when is_public = true (for discovery).
--
-- Resolves: Post-050 RLS gaps on new collab tables (Phase 3 hardening)

begin;

-- Re-apply RLS (idempotent)
alter table public.collab_sessions enable row level security;
alter table public.collab_session_participants enable row level security;

-- Drop old permissive policies if they exist (safe if they don't)
drop policy if exists "Users can view sessions they participate in" on public.collab_sessions;
drop policy if exists "Owners can create sessions" on public.collab_sessions;
drop policy if exists "Participants can update their own session" on public.collab_sessions;

-- ============================================
-- collab_sessions policies
-- ============================================

drop policy if exists "collab_sessions_select" on public.collab_sessions;
drop policy if exists "collab_sessions_insert" on public.collab_sessions;
drop policy if exists "collab_sessions_update" on public.collab_sessions;
drop policy if exists "collab_sessions_delete" on public.collab_sessions;

-- SELECT: Participants can see the session, or it's public
create policy "collab_sessions_select"
  on public.collab_sessions for select
  using (
    id in (select session_id from public.collab_session_participants where profile_id = auth.uid())
    or is_public = true
  );

-- INSERT: Only authenticated users can create (owner must be themselves)
create policy "collab_sessions_insert"
  on public.collab_sessions for insert
  with check (owner_id = auth.uid());

-- UPDATE: Only the owner can update core fields
create policy "collab_sessions_update"
  on public.collab_sessions for update
  using (owner_id = auth.uid());

-- DELETE: Only the owner can delete
create policy "collab_sessions_delete"
  on public.collab_sessions for delete
  using (owner_id = auth.uid());

-- ============================================
-- collab_session_participants policies
-- ============================================

drop policy if exists "collab_session_participants_select" on public.collab_session_participants;
drop policy if exists "collab_session_participants_insert" on public.collab_session_participants;
drop policy if exists "collab_session_participants_delete" on public.collab_session_participants;

-- SELECT: You can see participants of sessions you are part of
create policy "collab_session_participants_select"
  on public.collab_session_participants for select
  using (
    session_id in (
      select session_id from public.collab_session_participants 
      where profile_id = auth.uid()
    )
  );

-- INSERT: Only the session owner can add participants (or self-invite logic can be added later)
create policy "collab_session_participants_insert"
  on public.collab_session_participants for insert
  with check (
    session_id in (
      select id from public.collab_sessions where owner_id = auth.uid()
    )
  );

-- DELETE: You can remove yourself, or the session owner can remove anyone
create policy "collab_session_participants_delete"
  on public.collab_session_participants for delete
  using (
    profile_id = auth.uid()
    or session_id in (
      select id from public.collab_sessions where owner_id = auth.uid()
    )
  );

commit;
