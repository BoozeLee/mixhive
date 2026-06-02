-- Migration 057: promoters — promoter entity table + venues FK
--
-- booking_scout and venue_fit agents currently work with venue data only.
-- Promoters are the real booking contacts. This migration:
--   1. Creates a promoters entity table (city, genres, verified flag).
--   2. Adds an optional promoter_id FK on venues for venue-promoter linkage.
--   3. RLS: publicly readable when active; writes are service-role only.
--
-- Resolves: Phase 2 data architecture — promoters as first-class entities

begin;

create table if not exists public.promoters (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  city          text,
  country       text not null default 'BE',
  genres        text[] not null default '{}',
  contact_email text,
  website_url   text,
  is_verified   boolean not null default false,
  is_active     boolean not null default true,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_promoters_city_active
  on public.promoters (city, is_active)
  where is_active = true;

create index if not exists idx_promoters_genres
  on public.promoters using gin (genres);

alter table public.promoters enable row level security;

drop policy if exists "promoters_public_read" on public.promoters;
create policy "promoters_public_read"
  on public.promoters for select
  using (is_active = true);

drop policy if exists "promoters_service_all" on public.promoters;
create policy "promoters_service_all"
  on public.promoters for all
  using  (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Link venues to promoters (optional — null means no associated promoter)
alter table public.venues
  add column if not exists promoter_id uuid references public.promoters(id) on delete set null;

create index if not exists idx_venues_promoter
  on public.venues (promoter_id)
  where promoter_id is not null;

-- Resolves: Phase 2 data architecture — promoters as first-class entities
commit;
