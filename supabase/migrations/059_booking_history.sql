-- Migration 059: booking_history — immutable gig outcome log
--
-- booking_scout and release_strategy agents need confirmed gig history to
-- calibrate recommendations (past venues, outcomes, fees). This is modelled
-- as an append-only log: clients may insert their own rows, but not update
-- or delete them. Service role can do anything (admin correction path).
--
-- Resolves: Phase 2 data architecture — immutable booking outcome log

begin;

create table if not exists public.booking_history (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  opportunity_id  uuid references public.opportunities(id) on delete set null,
  venue_id        uuid references public.venues(id) on delete set null,
  promoter_id     uuid references public.promoters(id) on delete set null,
  gig_date        date not null,
  outcome         text not null default 'completed'
                    check (outcome in (
                      'confirmed', 'completed', 'cancelled', 'no_show'
                    )),
  fee_eur         numeric(10, 2),
  notes           text,
  referral_source text,
  created_at      timestamptz not null default now()
  -- no updated_at intentionally: this is an immutable log
);

create index if not exists idx_booking_history_user
  on public.booking_history (user_id, gig_date desc);

create index if not exists idx_booking_history_venue
  on public.booking_history (venue_id)
  where venue_id is not null;

alter table public.booking_history enable row level security;

drop policy if exists "booking_history_owner_read" on public.booking_history;
create policy "booking_history_owner_read"
  on public.booking_history for select
  using (auth.uid() = user_id);

-- Users can insert their own history rows
drop policy if exists "booking_history_owner_insert" on public.booking_history;
create policy "booking_history_owner_insert"
  on public.booking_history for insert
  with check (auth.uid() = user_id);

-- No client-side update or delete — log is immutable from user perspective
drop policy if exists "booking_history_service_all" on public.booking_history;
create policy "booking_history_service_all"
  on public.booking_history for all
  using  (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Resolves: Phase 2 data architecture — immutable booking outcome log
commit;
