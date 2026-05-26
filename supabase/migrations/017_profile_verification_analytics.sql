-- Professional profile verification and analytics.

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

create table if not exists public.verification_requests (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  dj_name text not null,
  links jsonb not null default '{}',
  proof text not null,
  requested_badge text not null default 'verified'
    check (requested_badge in ('verified', 'artist', 'official')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_verification_requests_pending
  on public.verification_requests(profile_id)
  where status = 'pending';

create index if not exists idx_verification_requests_status
  on public.verification_requests(status, created_at desc);

create table if not exists public.verification_badges (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  badge_type text not null check (badge_type in ('verified', 'artist', 'official')),
  label text not null,
  reason text,
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz
);

create unique index if not exists uq_verification_badges_profile_type
  on public.verification_badges(profile_id, badge_type);

create table if not exists public.analytics_events (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  mix_id uuid references public.mixes(id) on delete set null,
  event_type text not null check (
    event_type in ('profile_view', 'follow', 'upload', 'play', 'like', 'comment', 'share', 'verification')
  ),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_analytics_events_profile_time
  on public.analytics_events(profile_id, created_at desc);

create table if not exists public.profile_analytics_daily (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  profile_views int not null default 0,
  plays int not null default 0,
  likes int not null default 0,
  comments int not null default 0,
  shares int not null default 0,
  follows int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, day)
);

create or replace view public.profile_analytics as
select
  profile_id,
  day,
  profile_views,
  plays,
  likes,
  comments,
  shares,
  follows,
  created_at,
  updated_at
from public.profile_analytics_daily;

alter table public.verification_requests enable row level security;
alter table public.verification_badges enable row level security;
alter table public.analytics_events enable row level security;
alter table public.profile_analytics_daily enable row level security;

drop policy if exists "Users can read own verification requests" on public.verification_requests;
create policy "Users can read own verification requests"
  on public.verification_requests for select
  using (
    profile_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

drop policy if exists "Users can request own verification" on public.verification_requests;
create policy "Users can request own verification"
  on public.verification_requests for insert
  with check (profile_id = auth.uid());

drop policy if exists "Admins can update verification requests" on public.verification_requests;
create policy "Admins can update verification requests"
  on public.verification_requests for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

drop policy if exists "Badges are publicly readable" on public.verification_badges;
create policy "Badges are publicly readable"
  on public.verification_badges for select using (true);

drop policy if exists "Admins manage badges" on public.verification_badges;
create policy "Admins manage badges"
  on public.verification_badges for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

drop policy if exists "Analytics are readable by profile owner or admin" on public.analytics_events;
create policy "Analytics are readable by profile owner or admin"
  on public.analytics_events for select
  using (
    profile_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

drop policy if exists "Authenticated users can insert analytics" on public.analytics_events;
create policy "Authenticated users can insert analytics"
  on public.analytics_events for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "Daily analytics readable by owner or admin" on public.profile_analytics_daily;
create policy "Daily analytics readable by owner or admin"
  on public.profile_analytics_daily for select
  using (
    profile_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

create or replace function public.review_verification_request(
  p_request_id uuid,
  p_reviewer_id uuid,
  p_status text,
  p_reason text default null,
  p_badge_type text default null
) returns void as $$
declare
  v_request public.verification_requests%rowtype;
  v_is_admin boolean;
  v_badge text;
begin
  select coalesce(is_admin, false) into v_is_admin
  from public.profiles
  where id = p_reviewer_id;

  if not coalesce(v_is_admin, false) then
    raise exception 'Only admins can review verification requests';
  end if;

  select * into v_request
  from public.verification_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Verification request not found';
  end if;

  if p_status not in ('approved', 'rejected') then
    raise exception 'Invalid verification status';
  end if;

  update public.verification_requests
  set
    status = p_status,
    rejection_reason = case when p_status = 'rejected' then p_reason else null end,
    reviewed_by = p_reviewer_id,
    reviewed_at = now(),
    updated_at = now()
  where id = p_request_id;

  if p_status = 'approved' then
    v_badge := coalesce(p_badge_type, v_request.requested_badge, 'verified');

    insert into public.verification_badges (profile_id, badge_type, label, reason, granted_by)
    values (
      v_request.profile_id,
      v_badge,
      case v_badge
        when 'official' then 'Official'
        when 'artist' then 'Artist'
        else 'Verified'
      end,
      p_reason,
      p_reviewer_id
    )
    on conflict (profile_id, badge_type)
    do update set
      reason = excluded.reason,
      granted_by = excluded.granted_by,
      granted_at = now();

    update public.profiles
    set verified = true, updated_at = now()
    where id = v_request.profile_id;

    insert into public.analytics_events (profile_id, actor_id, event_type, metadata)
    values (
      v_request.profile_id,
      p_reviewer_id,
      'verification',
      jsonb_build_object('badge_type', v_badge, 'request_id', p_request_id)
    );
  end if;
end;
$$ language plpgsql security definer;
