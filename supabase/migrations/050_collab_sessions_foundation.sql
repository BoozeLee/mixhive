-- Migration 050: Collab Sessions Foundation (Experiment 1 - Slice 1.1)
--
-- Creates the core tables for Mythic Co-Production Sessions:
--   - collab_sessions: The session workspace
--   - collab_session_participants: Multi-user access control
--
-- Adds supporting functions for creation and ending sessions.
-- On session end, enqueues a lightweight post-process job for graph edge proposals.
--
-- Design decisions (from 22- PRD):
--   - Dedicated tables (not overloading mixes)
--   - RLS-first design
--   - Realtime-friendly (presence + chat will use these ids)
--   - Links to mythic graph on completion
--
-- Resolves: Phase 6.5/7 Experiment 1 - Core data model foundation

begin;

-- ============================================
-- 1. Core Tables
-- ============================================

create table if not exists public.collab_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'ended', 'archived')),
  is_public boolean default false,
  created_at timestamptz default now(),
  ended_at timestamptz,
  metadata jsonb default '{}'::jsonb
);

create table if not exists public.collab_session_participants (
  session_id uuid not null references public.collab_sessions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text default 'participant' check (role in ('owner', 'participant')),
  joined_at timestamptz default now(),
  primary key (session_id, profile_id)
);

-- Helpful indexes
create index if not exists idx_collab_sessions_owner on public.collab_sessions(owner_id);
create index if not exists idx_collab_sessions_status on public.collab_sessions(status);
create index if not exists idx_collab_session_participants_profile on public.collab_session_participants(profile_id);

-- ============================================
-- 2. RLS Policies (strict but practical)
-- ============================================

alter table public.collab_sessions enable row level security;
alter table public.collab_session_participants enable row level security;

-- Sessions are visible to participants + owner
create policy "Users can view sessions they participate in"
  on public.collab_sessions for select
  using (
    id in (
      select session_id from public.collab_session_participants 
      where profile_id = auth.uid()
    )
    or owner_id = auth.uid()
  );

-- Only owner can create
create policy "Owners can create sessions"
  on public.collab_sessions for insert
  with check (owner_id = auth.uid());

-- Participants/owner can update limited fields while active
create policy "Participants can update their own session"
  on public.collab_sessions for update
  using (
    id in (
      select session_id from public.collab_session_participants 
      where profile_id = auth.uid()
    )
  );

-- ============================================
-- 3. Core Functions
-- ============================================

-- Create a new session + add owner as participant
create or replace function public.create_collab_session(
  p_title text,
  p_description text default null,
  p_is_public boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.collab_sessions (title, description, owner_id, is_public)
  values (p_title, p_description, auth.uid(), p_is_public)
  returning id into v_session_id;

  -- Add owner as participant
  insert into public.collab_session_participants (session_id, profile_id, role)
  values (v_session_id, auth.uid(), 'owner');

  return v_session_id;
end;
$$;

-- End a session and enqueue post-processing job for graph edges
create or replace function public.end_collab_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.collab_sessions 
    where id = p_session_id and owner_id = auth.uid()
  ) then
    raise exception 'Not authorized or session not found';
  end if;

  update public.collab_sessions
  set status = 'ended', ended_at = now()
  where id = p_session_id;

  -- Enqueue lightweight job for edge proposal generation (Experiment 1 post-process)
  insert into public.mythic_graph_jobs (job_type, payload, status, owner_id)
  values (
    'collab_session_post_process',
    jsonb_build_object('session_id', p_session_id),
    'pending',
    auth.uid()
  );
end;
$$;

-- Grant execute rights
grant execute on function public.create_collab_session(text, text, boolean) to authenticated;
grant execute on function public.end_collab_session(uuid) to authenticated;

comment on table public.collab_sessions is 'Mythic Co-Production Sessions - temporary collaborative workspaces with graph provenance on completion.';
comment on table public.collab_session_participants is 'Access control and participation tracking for collab sessions.';

commit;