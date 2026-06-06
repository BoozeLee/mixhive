-- Migration 088: Core 1:1 Direct Messaging
-- Depends: 039 (notifications.type check), 085 (marketplace_ledger)
-- Note: notifications.type CHECK rewrite includes 'verification' (from 086),
-- 'message' (new), and 'agent_purchased'/'agent_sale'/'gear_sale' (webhook types
-- missing from 039 constraint -- fixes latent bug regardless of merge order).

begin;

-- ===== 1. conversations =====
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  is_group boolean not null default false,
  title text,
  created_by uuid references public.profiles(id) on delete set null,
  dm_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz
);

comment on column public.conversations.dm_key is
  'Sorted least(a,b)||":"||greatest(a,b) of member ids; null for groups; dedupes 1:1 convos';

create index if not exists idx_conversations_last_message_at
  on public.conversations(last_message_at desc);

-- ===== 2. conversation_members =====
create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (conversation_id, profile_id)
);

create index if not exists idx_conversation_members_profile_id
  on public.conversation_members(profile_id);

-- ===== 3. messages =====
create table if not exists public.messages (
  id uuid primary key, -- client-supplied (reused as DB row id for dedupe)
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  attachment jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_conversation_created
  on public.messages(conversation_id, created_at desc);

-- ===== 4. RLS =====
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

-- Conversations: SELECT if member
create policy if not exists conversations_select_member
  on public.conversations for select
  using (exists (
    select 1 from public.conversation_members m
    where m.conversation_id = conversations.id and m.profile_id = auth.uid()
  ));

-- Conversation members: SELECT if own row
create policy if not exists conversation_members_select_member
  on public.conversation_members for select
  using (profile_id = auth.uid());

-- Messages: SELECT if member of the conversation
create policy if not exists messages_select_member
  on public.messages for select
  using (exists (
    select 1 from public.conversation_members m
    where m.conversation_id = messages.conversation_id and m.profile_id = auth.uid()
  ));

-- Messages: INSERT = sender is me AND I'm a member AND not blocked
create policy if not exists messages_insert_member
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversation_members m
      where m.conversation_id = messages.conversation_id and m.profile_id = auth.uid()
    )
    and not exists (
      select 1 from public.user_blocks b
      where (
        (b.blocker_id = auth.uid() and b.blocked_id = (
          select cm.profile_id from public.conversation_members cm
          where cm.conversation_id = messages.conversation_id and cm.profile_id != auth.uid()
          limit 1
        ))
        or
        (b.blocked_id = auth.uid() and b.blocker_id = (
          select cm.profile_id from public.conversation_members cm
          where cm.conversation_id = messages.conversation_id and cm.profile_id != auth.uid()
          limit 1
        ))
      )
    )
  );

-- Conversation members: UPDATE last_read_at = own row only
create policy if not exists conversation_members_update_own
  on public.conversation_members for update
  using (profile_id = auth.uid());

-- ===== 5. get_or_create_dm RPC =====
create or replace function public.get_or_create_dm(p_other uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_dm_key text;
  v_conversation_id uuid;
  v_other_profile_id uuid;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  if p_other = v_me then
    raise exception 'Cannot create DM with yourself';
  end if;

  select id into v_other_profile_id from public.profiles where id = p_other;
  if v_other_profile_id is null then
    raise exception 'User not found';
  end if;

  if exists (
    select 1 from public.user_blocks
    where (blocker_id = v_me and blocked_id = p_other)
       or (blocker_id = p_other and blocked_id = v_me)
  ) then
    raise exception 'Blocked';
  end if;

  v_dm_key := least(v_me::text, p_other::text) || ':' || greatest(v_me::text, p_other::text);

  select id into v_conversation_id
  from public.conversations
  where dm_key = v_dm_key;

  if v_conversation_id is not null then
    return v_conversation_id;
  end if;

  insert into public.conversations (is_group, dm_key, created_by)
  values (false, v_dm_key, v_me)
  returning id into v_conversation_id;

  insert into public.conversation_members (conversation_id, profile_id)
  values (v_conversation_id, v_me), (v_conversation_id, p_other);

  return v_conversation_id;
end;
$$;

revoke execute on function public.get_or_create_dm(uuid) from public, anon;
grant execute on function public.get_or_create_dm(uuid) to authenticated;

-- ===== 6. AFTER INSERT trigger on messages =====
create or replace function public.handle_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set last_message_at = new.created_at,
      updated_at = new.created_at
  where id = new.conversation_id;

  insert into public.notifications (user_id, type, actor_id, data)
  select
    cm.profile_id,
    'message',
    new.sender_id,
    jsonb_build_object(
      'conversation_id', new.conversation_id,
      'preview', left(new.body, 120)
    )
  from public.conversation_members cm
  where cm.conversation_id = new.conversation_id
    and cm.profile_id != new.sender_id;

  return new;
end;
$$;

drop trigger if exists trg_message_insert on public.messages;
create trigger trg_message_insert
  after insert on public.messages
  for each row
  execute function public.handle_message_insert();

-- ===== 7. Extend notifications.type CHECK =====
alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
    check (type = any (array[
      'like'::text,
      'follow'::text,
      'comment'::text,
      'reply'::text,
      'mix_upload'::text,
      'mention'::text,
      'buzz_like'::text,
      'repost'::text,
      'verification'::text,
      'message'::text,
      'agent_purchased'::text,
      'agent_sale'::text,
      'gear_sale'::text
    ]));

-- ===== 8. Realtime publication =====
do $$
declare
  pub_exists boolean;
begin
  select exists(select 1 from pg_publication where pubname = 'supabase_realtime') into pub_exists;
  if not pub_exists then
    create publication supabase_realtime;
  end if;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.conversations;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.conversation_members;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;

commit;
-- Resolves: Phase 4 Slice A -- Core 1:1 DMs
