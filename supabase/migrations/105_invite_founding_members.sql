-- Migration 105: Invite codes + founding member status
--
-- Enables a gated First-50 onboarding: admin generates invite codes, new users
-- optionally redeem one on sign-up to become founding members with a 500 XP bonus.
-- Founding members are tracked via is_founding_member on profiles.

begin;

-- 1. Founding-member flag on profiles
alter table public.profiles
  add column if not exists is_founding_member boolean not null default false,
  add column if not exists invite_code_used text;

-- 2. Invites table
create table if not exists public.invites (
  id             uuid primary key default gen_random_uuid(),
  code           text unique not null,
  created_by     uuid references public.profiles(id) on delete set null,
  label          text,                             -- human note (e.g. "Chantzis batch 1")
  max_uses       int not null default 1,
  uses_count     int not null default 0,
  expires_at     timestamptz,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

create index if not exists idx_invites_code on public.invites(code);
create index if not exists idx_invites_active on public.invites(is_active) where is_active;

-- 3. Invite redemptions (audit log)
create table if not exists public.invite_redemptions (
  id         uuid primary key default gen_random_uuid(),
  invite_id  uuid not null references public.invites(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  unique(invite_id, user_id)
);

create index if not exists idx_invite_redemptions_user on public.invite_redemptions(user_id);

-- 4. RLS
alter table public.invites enable row level security;
alter table public.invite_redemptions enable row level security;

-- Public can read active invites (to check validity before sign-up)
drop policy if exists "invites_public_read" on public.invites;
create policy "invites_public_read" on public.invites
  for select using (is_active = true);

-- Only service role can insert/update/delete invites
-- (handled server-side via createServerClient)

-- Users can read their own redemptions
drop policy if exists "redemptions_own_read" on public.invite_redemptions;
create policy "redemptions_own_read" on public.invite_redemptions
  for select using (user_id = auth.uid());

-- 5. RPC: redeem_invite — called server-side (security definer, service role bypasses RLS anyway)
-- Awards 500 XP and sets founding member status.
create or replace function public.redeem_invite(
  p_code    text,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite        public.invites%rowtype;
  v_already_used  boolean;
  v_new_xp        integer;
  v_new_level     integer;
begin
  -- Lock the invite row
  select * into v_invite
  from public.invites
  where code = p_code
    and is_active = true
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  if v_invite.uses_count >= v_invite.max_uses then
    return jsonb_build_object('ok', false, 'error', 'exhausted');
  end if;

  -- Idempotency: already redeemed by this user?
  select exists(
    select 1 from public.invite_redemptions
    where invite_id = v_invite.id and user_id = p_user_id
  ) into v_already_used;

  if v_already_used then
    return jsonb_build_object('ok', false, 'error', 'already_used');
  end if;

  -- Record redemption
  insert into public.invite_redemptions(invite_id, user_id)
  values (v_invite.id, p_user_id);

  -- Increment use count
  update public.invites
  set uses_count = uses_count + 1
  where id = v_invite.id;

  -- Award 500 XP + founding member
  update public.profiles
  set
    xp                 = xp + 500,
    level              = public.calculate_level(xp + 500),
    is_founding_member = true,
    invite_code_used   = p_code
  where id = p_user_id
  returning xp, level into v_new_xp, v_new_level;

  return jsonb_build_object(
    'ok',    true,
    'xp',    v_new_xp,
    'level', v_new_level
  );
end;
$$;

commit;
