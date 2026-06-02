-- Migration 063: verified_partners + partner_seats — Phase 5 B2B foundation
--
-- Lays the database groundwork for the VI.BE partnership and future B2B
-- integrations. verified_partners stores API credentials (key hash only —
-- raw keys never stored), allowed data tables, and rate limits. partner_seats
-- links individual users to partner organisations with time-bounded access.
--
-- These tables are placeholders for Phase 5 implementation; nothing in the
-- application calls them yet. Adding them now avoids a blocking migration
-- when Phase 5 begins.
--
-- Resolves: Phase 2 data architecture — Phase 5 partner infrastructure prep

begin;

create table if not exists public.verified_partners (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  slug                 text not null unique,
  api_key_hash         text not null,       -- bcrypt/sha256 hash only, never plaintext
  contact_email        text,
  tier                 text not null default 'pilot'
                         check (tier in ('pilot', 'standard', 'premium')),
  allowed_tables       text[] not null default '{}',
  rate_limit_per_hour  int not null default 100,
  is_active            boolean not null default false,
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.verified_partners enable row level security;

-- Only service-role can access partner records (admin-only table)
drop policy if exists "verified_partners_service_only" on public.verified_partners;
create policy "verified_partners_service_only"
  on public.verified_partners for all
  using  (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- =====================================================================
-- partner_seats — links profiles to partner organisations
-- =====================================================================

create table if not exists public.partner_seats (
  id           uuid primary key default gen_random_uuid(),
  partner_id   uuid not null references public.verified_partners(id) on delete cascade,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  granted_by   uuid references public.profiles(id) on delete set null,
  granted_at   timestamptz not null default now(),
  expires_at   timestamptz,

  unique (partner_id, profile_id)
);

create index if not exists idx_partner_seats_profile
  on public.partner_seats (profile_id);

alter table public.partner_seats enable row level security;

-- Users can see their own seats
drop policy if exists "partner_seats_owner_read" on public.partner_seats;
create policy "partner_seats_owner_read"
  on public.partner_seats for select
  using (auth.uid() = profile_id);

drop policy if exists "partner_seats_service_all" on public.partner_seats;
create policy "partner_seats_service_all"
  on public.partner_seats for all
  using  (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Resolves: Phase 2 data architecture — Phase 5 partner infrastructure prep
commit;
