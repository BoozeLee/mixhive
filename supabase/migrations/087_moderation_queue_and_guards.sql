-- Phase 3 (Trust) — Slice 2: moderation review queue + abuse guards.
--
-- 1. Adds a status/resolution lifecycle to moderation_signals (was capture-only,
--    service-role-only) plus admin RLS so an admin queue UI can read & action them.
-- 2. review_moderation_signal() RPC (admin-only) records the decision and applies
--    the side effect: hide -> source row moderation_status='hidden';
--    ban -> owning profile moderation_status='banned'.
-- 3. Server-enforced disposable-email rejection at signup (handle_new_user).

begin;

-- ===== 1. moderation_signals: status + resolution =====
alter table public.moderation_signals
  add column if not exists status text not null default 'open'
    check (status in ('open', 'reviewing', 'actioned', 'dismissed')),
  add column if not exists resolved_by uuid references public.profiles(id) on delete set null,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolution_notes text;

create index if not exists moderation_signals_status_idx
  on public.moderation_signals (status, severity, created_at desc);

-- Admins can read & resolve via RLS. Service role bypasses RLS, so the moderation
-- agent and /api/reports continue to insert signals unaffected.
drop policy if exists "Admins read moderation signals" on public.moderation_signals;
create policy "Admins read moderation signals"
  on public.moderation_signals for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

drop policy if exists "Admins update moderation signals" on public.moderation_signals;
create policy "Admins update moderation signals"
  on public.moderation_signals for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- ===== 2. Admin action RPC =====
create or replace function public.review_moderation_signal(
  p_signal_id uuid,
  p_reviewer_id uuid,
  p_action text,
  p_notes text default null
) returns void as $$
declare
  v_is_admin boolean;
  v_sig public.moderation_signals%rowtype;
  v_owner uuid;
begin
  select coalesce(is_admin, false) into v_is_admin
  from public.profiles where id = p_reviewer_id;
  if not coalesce(v_is_admin, false) then
    raise exception 'Only admins can review moderation signals';
  end if;

  if p_action not in ('hide', 'ban', 'dismiss') then
    raise exception 'Invalid moderation action';
  end if;

  select * into v_sig from public.moderation_signals where id = p_signal_id for update;
  if not found then
    raise exception 'Moderation signal not found';
  end if;

  update public.moderation_signals
  set status = case when p_action = 'dismiss' then 'dismissed' else 'actioned' end,
      action_taken = p_action,
      resolved_by = p_reviewer_id,
      resolved_at = now(),
      resolution_notes = p_notes
  where id = p_signal_id;

  -- hide: flip the source row's moderation_status (tables that have the column).
  if p_action = 'hide' and v_sig.source_id is not null
     and v_sig.source_table in ('buzzes', 'mixes', 'comments', 'profiles') then
    execute format(
      'update public.%I set moderation_status = ''hidden'', moderation_reason = $1 where id = $2',
      v_sig.source_table
    ) using p_notes, v_sig.source_id;
  end if;

  -- ban: resolve the owning profile from the flagged row and mark it banned.
  if p_action = 'ban' and v_sig.source_id is not null then
    v_owner := case v_sig.source_table
      when 'profiles' then v_sig.source_id
      when 'buzzes' then (select author_id from public.buzzes where id = v_sig.source_id)
      when 'mixes' then (select dj_id from public.mixes where id = v_sig.source_id)
      when 'comments' then (select user_id from public.comments where id = v_sig.source_id)
      when 'equipment_listings' then (select seller_profile_id from public.equipment_listings where id = v_sig.source_id)
      else null
    end;
    if v_owner is not null then
      update public.profiles
      set moderation_status = 'banned', moderation_reason = p_notes, updated_at = now()
      where id = v_owner;
    end if;
  end if;
end;
$$ language plpgsql security definer;

-- ===== 3. Disposable-email guard at signup =====
create table if not exists public.disposable_email_domains (
  domain text primary key
);

insert into public.disposable_email_domains (domain) values
  ('mailinator.com'), ('guerrillamail.com'), ('10minutemail.com'), ('tempmail.com'),
  ('temp-mail.org'), ('throwawaymail.com'), ('yopmail.com'), ('trashmail.com'),
  ('getnada.com'), ('dispostable.com'), ('maildrop.cc'), ('fakeinbox.com'),
  ('sharklasers.com'), ('guerrillamailblock.com'), ('mailnesia.com'), ('mintemail.com'),
  ('mohmal.com'), ('emailondeck.com'), ('spamgourmet.com'), ('tempr.email')
on conflict (domain) do nothing;

create or replace function public.is_disposable_email(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.disposable_email_domains d
    where d.domain = lower(split_part(coalesce(p_email, ''), '@', 2))
  );
$$;

-- Re-create handle_new_user (from migration 037) with a disposable-domain rejection
-- at the top. Body below is identical to 037 apart from that guard.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_username text;
  raw_display_name text;
begin
  if public.is_disposable_email(new.email) then
    raise exception 'Disposable email addresses are not allowed';
  end if;

  raw_username := coalesce(
    new.raw_user_meta_data ->> 'preferred_username',
    new.raw_user_meta_data ->> 'username',
    new.email
  );

  raw_display_name := coalesce(
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'full_name',
    new.email
  );

  insert into public.profiles (
    id,
    username,
    display_name,
    avatar_url
  )
  values (
    new.id,
    public.ensure_unique_signup_username(raw_username, new.id),
    raw_display_name,
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
    set username = excluded.username,
        display_name = excluded.display_name,
        avatar_url = excluded.avatar_url,
        updated_at = now();

  return new;
end;
$$;

commit;
