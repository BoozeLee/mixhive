-- P7: Mythic Live Creative Rituals
-- Typed creator/audience roles, persistent timeline, synchronized playback,
-- votes, bounded agent actions, and replay/handoff foundations.

begin;

alter table public.collab_session_participants
  drop constraint if exists collab_session_participants_role_check;
alter table public.collab_session_participants
  add constraint collab_session_participants_role_check
  check (role in ('owner', 'participant', 'creator', 'moderator'));

create table if not exists public.collab_session_audience (
  session_id uuid not null references public.collab_sessions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'muted', 'removed')),
  joined_at timestamptz not null default now(),
  primary key (session_id, profile_id)
);

create table if not exists public.collab_session_assets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.collab_sessions(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 240),
  storage_path text not null,
  mime_type text not null default 'audio/mpeg',
  duration_seconds numeric,
  asset_type text not null default 'stem' check (asset_type in ('stem', 'mix', 'preview')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.collab_session_state (
  session_id uuid primary key references public.collab_sessions(id) on delete cascade,
  current_asset_id uuid references public.collab_session_assets(id) on delete set null,
  playback_status text not null default 'paused' check (playback_status in ('paused', 'playing')),
  anchor_position numeric not null default 0 check (anchor_position >= 0),
  anchor_timestamp timestamptz not null default now(),
  revision bigint not null default 0,
  agent_enabled boolean not null default true,
  agent_budget_remaining integer not null default 5 check (agent_budget_remaining between 0 and 20),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.collab_session_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.collab_sessions(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null default 'audience' check (channel in ('audience', 'creators')),
  body text not null check (char_length(body) between 1 and 1000),
  moderation_status text not null default 'visible' check (moderation_status in ('visible', 'hidden')),
  created_at timestamptz not null default now()
);

create table if not exists public.collab_session_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.collab_sessions(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_type text not null default 'profile' check (actor_type in ('profile', 'agent', 'system')),
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.collab_session_invites (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.collab_sessions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'creator' check (role in ('creator', 'moderator')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired')),
  invited_by uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now(),
  unique (session_id, profile_id)
);

create table if not exists public.collab_session_votes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.collab_sessions(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  actor_type text not null default 'profile' check (actor_type in ('profile', 'agent')),
  prompt text not null check (char_length(prompt) between 1 and 300),
  options jsonb not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  selected_option text,
  closes_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.collab_session_vote_responses (
  vote_id uuid not null references public.collab_session_votes(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  option text not null,
  created_at timestamptz not null default now(),
  primary key (vote_id, profile_id)
);

create table if not exists public.collab_session_handoff_tokens (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.collab_sessions(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null default now() + interval '10 minutes',
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists collab_session_assets_session_idx on public.collab_session_assets(session_id, created_at);
create index if not exists collab_session_messages_session_idx on public.collab_session_messages(session_id, created_at);
create index if not exists collab_session_events_session_idx on public.collab_session_events(session_id, created_at);
create index if not exists collab_session_votes_session_idx on public.collab_session_votes(session_id, created_at desc);

alter table public.collab_session_audience enable row level security;
alter table public.collab_session_assets enable row level security;
alter table public.collab_session_state enable row level security;
alter table public.collab_session_messages enable row level security;
alter table public.collab_session_events enable row level security;
alter table public.collab_session_invites enable row level security;
alter table public.collab_session_votes enable row level security;
alter table public.collab_session_vote_responses enable row level security;
alter table public.collab_session_handoff_tokens enable row level security;

create or replace function public.can_view_collab_session(p_session_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.collab_sessions s
    where s.id = p_session_id
      and (
        s.is_public
        or s.owner_id = auth.uid()
        or exists (select 1 from public.collab_session_participants p where p.session_id = s.id and p.profile_id = auth.uid())
      )
  );
$$;

create or replace function public.can_manage_collab_session(p_session_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.collab_sessions s
    where s.id = p_session_id and s.status = 'active' and s.owner_id = auth.uid()
  ) or exists (
    select 1 from public.collab_session_participants p
    join public.collab_sessions s on s.id = p.session_id
    where p.session_id = p_session_id
      and s.status = 'active'
      and p.profile_id = auth.uid()
      and p.role in ('owner', 'creator', 'moderator', 'participant')
  );
$$;

create or replace function public.can_chat_collab_session(p_session_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.can_view_collab_session(p_session_id)
    and exists (
      select 1 from public.collab_sessions s
      where s.id = p_session_id and s.status = 'active'
    )
    and not exists (
      select 1 from public.collab_session_audience a
      where a.session_id = p_session_id
        and a.profile_id = auth.uid()
        and a.status in ('muted', 'removed')
    );
$$;

create or replace function public.join_public_collab_session(p_session_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_existing text;
  v_count integer;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists (
    select 1 from public.collab_sessions
    where id = p_session_id and is_public and status = 'active'
  ) then raise exception 'Session is not open to the audience'; end if;

  perform pg_advisory_xact_lock(hashtext(p_session_id::text));
  select status into v_existing from public.collab_session_audience
  where session_id = p_session_id and profile_id = auth.uid();
  if v_existing = 'removed' then raise exception 'You were removed from this ritual'; end if;
  if v_existing is not null then return v_existing; end if;

  select count(*) into v_count from public.collab_session_audience
  where session_id = p_session_id and status <> 'removed';
  if v_count >= 100 then raise exception 'This ritual has reached its audience capacity'; end if;

  insert into public.collab_session_audience(session_id, profile_id)
  values (p_session_id, auth.uid());
  return 'active';
end;
$$;

create or replace function public.create_mythic_ritual(
  p_title text,
  p_description text default null,
  p_is_public boolean default false,
  p_agent_enabled boolean default true,
  p_invited_creator_ids uuid[] default '{}'::uuid[]
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_session_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if char_length(trim(p_title)) not between 1 and 200 then raise exception 'Invalid title'; end if;
  if cardinality(p_invited_creator_ids) > 5 then raise exception 'Too many creator invites'; end if;

  insert into public.collab_sessions(title, description, owner_id, is_public)
  values (trim(p_title), p_description, auth.uid(), p_is_public)
  returning id into v_session_id;
  insert into public.collab_session_participants(session_id, profile_id, role)
  values (v_session_id, auth.uid(), 'owner');
  insert into public.collab_session_state(session_id, agent_enabled, updated_by)
  values (v_session_id, p_agent_enabled, auth.uid());
  insert into public.collab_session_invites(session_id, profile_id, invited_by, role)
  select v_session_id, invited_id, auth.uid(), 'creator'
  from (select distinct unnest(p_invited_creator_ids) as invited_id) invited
  where invited_id <> auth.uid();
  insert into public.collab_session_events(session_id, actor_id, event_type, payload)
  values (
    v_session_id,
    auth.uid(),
    'ritual_started',
    jsonb_build_object('is_public', p_is_public, 'agent_enabled', p_agent_enabled)
  );
  return v_session_id;
end;
$$;

create or replace function public.claim_collab_agent_action(
  p_session_id uuid,
  p_cooldown_seconds integer default 120
)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_state public.collab_session_state%rowtype;
  v_remaining integer;
begin
  if not public.can_manage_collab_session(p_session_id) then raise exception 'Not authorized'; end if;
  perform pg_advisory_xact_lock(hashtext('ritual-agent:' || p_session_id::text));
  select * into v_state from public.collab_session_state where session_id = p_session_id for update;
  if not found or not v_state.agent_enabled or v_state.agent_budget_remaining <= 0 then
    raise exception 'Session Spirit is paused or out of actions';
  end if;
  if exists (
    select 1 from public.collab_session_events
    where session_id = p_session_id
      and actor_type = 'agent'
      and created_at > now() - make_interval(secs => greatest(p_cooldown_seconds, 1))
  ) then raise exception 'Session Spirit is observing before its next move'; end if;

  update public.collab_session_state
  set agent_budget_remaining = agent_budget_remaining - 1,
      updated_by = auth.uid(),
      updated_at = now()
  where session_id = p_session_id
  returning agent_budget_remaining into v_remaining;
  insert into public.collab_session_events(session_id, actor_id, actor_type, event_type)
  values (p_session_id, auth.uid(), 'agent', 'agent_claimed');
  return v_remaining;
end;
$$;

create or replace function public.accept_collab_session_invite(p_session_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_invite public.collab_session_invites%rowtype;
begin
  select * into v_invite from public.collab_session_invites
  where session_id = p_session_id and profile_id = auth.uid() and status = 'pending'
  for update;
  if not found
    or v_invite.expires_at < now()
    or not exists (
      select 1 from public.collab_sessions
      where id = p_session_id and status = 'active'
    )
  then raise exception 'Invite unavailable'; end if;
  update public.collab_session_invites
  set status = case when p_accept then 'accepted' else 'declined' end
  where id = v_invite.id;
  if p_accept then
    insert into public.collab_session_participants(session_id, profile_id, role)
    values (p_session_id, auth.uid(), v_invite.role)
    on conflict (session_id, profile_id) do update set role = excluded.role;
  end if;
end;
$$;

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

drop policy if exists "Public can view active rituals" on public.collab_sessions;
create policy "Public can view active rituals" on public.collab_sessions for select
using (is_public);
drop policy if exists "Invitees can view ritual" on public.collab_sessions;
create policy "Invitees can view ritual" on public.collab_sessions for select
using (
  exists (
    select 1 from public.collab_session_invites i
    where i.session_id = id
      and i.profile_id = auth.uid()
      and i.status in ('pending', 'accepted')
      and i.expires_at > now()
  )
);

create policy "ritual audience view" on public.collab_session_audience for select using (public.can_view_collab_session(session_id));
create policy "ritual audience join" on public.collab_session_audience for insert with check (profile_id = auth.uid() and public.can_view_collab_session(session_id));
create policy "ritual audience self leave" on public.collab_session_audience for delete using (profile_id = auth.uid() or public.can_manage_collab_session(session_id));
create policy "ritual audience moderation" on public.collab_session_audience for update using (public.can_manage_collab_session(session_id));

create policy "ritual assets view" on public.collab_session_assets for select using (public.can_view_collab_session(session_id));
create policy "ritual assets creator insert" on public.collab_session_assets for insert with check (uploader_id = auth.uid() and public.can_manage_collab_session(session_id));
create policy "ritual assets creator delete" on public.collab_session_assets for delete using (uploader_id = auth.uid() or public.can_manage_collab_session(session_id));

create policy "ritual state view" on public.collab_session_state for select using (public.can_view_collab_session(session_id));
create policy "ritual state creator write" on public.collab_session_state for all using (public.can_manage_collab_session(session_id)) with check (public.can_manage_collab_session(session_id));

create policy "ritual messages view" on public.collab_session_messages for select using (public.can_view_collab_session(session_id) and moderation_status = 'visible');
create policy "ritual messages signed-in insert" on public.collab_session_messages for insert with check (sender_id = auth.uid() and public.can_chat_collab_session(session_id));
create policy "ritual messages moderation" on public.collab_session_messages for update using (public.can_manage_collab_session(session_id));

create policy "ritual events view" on public.collab_session_events for select using (public.can_view_collab_session(session_id));
create policy "ritual events creator insert" on public.collab_session_events for insert with check (actor_id = auth.uid() and public.can_view_collab_session(session_id));

create policy "ritual invites view" on public.collab_session_invites for select using (profile_id = auth.uid() or public.can_manage_collab_session(session_id));
create policy "ritual invites manage" on public.collab_session_invites for all using (public.can_manage_collab_session(session_id)) with check (public.can_manage_collab_session(session_id));

create policy "ritual votes view" on public.collab_session_votes for select using (public.can_view_collab_session(session_id));
create policy "ritual votes creator write" on public.collab_session_votes for all using (public.can_manage_collab_session(session_id)) with check (public.can_manage_collab_session(session_id));
create policy "ritual vote responses view" on public.collab_session_vote_responses for select using (
  exists (select 1 from public.collab_session_votes v where v.id = vote_id and public.can_view_collab_session(v.session_id))
);
create policy "ritual vote responses insert" on public.collab_session_vote_responses for insert with check (
  profile_id = auth.uid()
  and exists (
    select 1 from public.collab_session_votes v
    where v.id = vote_id
      and v.status = 'open'
      and v.options ? option
      and public.can_chat_collab_session(v.session_id)
  )
);
create policy "ritual vote responses update" on public.collab_session_vote_responses for update
using (profile_id = auth.uid())
with check (
  profile_id = auth.uid()
  and exists (
    select 1 from public.collab_session_votes v
    where v.id = vote_id
      and v.status = 'open'
      and v.options ? option
      and public.can_chat_collab_session(v.session_id)
  )
);
create policy "ritual handoff creator manage" on public.collab_session_handoff_tokens for all using (public.can_manage_collab_session(session_id)) with check (created_by = auth.uid() and public.can_manage_collab_session(session_id));

do $$ begin
  alter publication supabase_realtime add table public.collab_session_state;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.collab_session_messages;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.collab_session_events;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.collab_session_votes;
exception when duplicate_object then null;
end $$;

revoke execute on function public.can_view_collab_session(uuid) from public, anon;
revoke execute on function public.can_manage_collab_session(uuid) from public, anon;
revoke execute on function public.can_chat_collab_session(uuid) from public, anon;
revoke execute on function public.join_public_collab_session(uuid) from public, anon;
revoke execute on function public.create_mythic_ritual(text, text, boolean, boolean, uuid[]) from public, anon;
revoke execute on function public.claim_collab_agent_action(uuid, integer) from public, anon;
revoke execute on function public.accept_collab_session_invite(uuid, boolean) from public, anon;
revoke execute on function public.end_collab_session(uuid) from public, anon;
grant execute on function public.can_view_collab_session(uuid) to authenticated;
grant execute on function public.can_manage_collab_session(uuid) to authenticated;
grant execute on function public.can_chat_collab_session(uuid) to authenticated;
grant execute on function public.join_public_collab_session(uuid) to authenticated;
grant execute on function public.create_mythic_ritual(text, text, boolean, boolean, uuid[]) to authenticated;
grant execute on function public.claim_collab_agent_action(uuid, integer) to authenticated;
grant execute on function public.accept_collab_session_invite(uuid, boolean) to authenticated;
grant execute on function public.end_collab_session(uuid) to authenticated;

commit;
