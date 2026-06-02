-- Migration 056: availability — structured availability windows
--
-- Provides date-range slots per artist (gig, collab, session, festival,
-- residency). booking_scout and opportunity_match agents use get_artist_availability
-- (added in 062) to filter opportunities by real schedule constraints.
-- artist_goals.booking_open boolean is preserved as a quick summary flag.
--
-- Resolves: Phase 2 data architecture — structured availability for booking agents

begin;

create table if not exists public.availability (
  id                bigint generated always as identity primary key,
  user_id           uuid not null references public.profiles(id) on delete cascade,
  availability_type text not null default 'gig'
                      check (availability_type in (
                        'gig', 'collab', 'session', 'festival', 'residency'
                      )),
  date_from         date,
  date_to           date,
  timezone          text not null default 'Europe/Brussels',
  notes             text,
  is_open           boolean not null default true,
  recurring         boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint date_range_valid check (date_from is null or date_to is null or date_from <= date_to)
);

create index if not exists idx_availability_user
  on public.availability (user_id);

create index if not exists idx_availability_open_date
  on public.availability (is_open, date_from)
  where is_open = true;

alter table public.availability enable row level security;

drop policy if exists "availability_owner_all" on public.availability;
create policy "availability_owner_all"
  on public.availability for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "availability_public_read" on public.availability;
create policy "availability_public_read"
  on public.availability for select
  using (is_open = true);

drop policy if exists "availability_service_all" on public.availability;
create policy "availability_service_all"
  on public.availability for all
  using  (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Backfill: create an open indefinite 'gig' slot for every artist whose
-- artist_goals has booking_open = true.
insert into public.availability (user_id, availability_type, is_open, notes)
select
  user_id,
  'gig',
  true,
  'Migrated from artist_goals.booking_open'
from public.artist_goals
where booking_open = true
on conflict do nothing;

-- Resolves: Phase 2 data architecture — structured availability for booking agents
commit;
