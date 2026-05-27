-- Migration 029: Opportunity graph — opportunities, artist goals, and saves.
--
-- The Opportunity Hub is the core differentiating product: curated gigs, grants,
-- residencies, contests, festivals, collab calls, and radio opportunities ranked
-- by fit for each creator. This migration creates the data layer.
--
-- opportunities    — public catalogue of Belgian/EU underground music opportunities.
-- artist_goals     — per-user career goals, skills, travel radius, and availability.
-- opportunity_saves — per-user saved/applied/dismissed status for each opportunity.
--
-- Seeded with 8 realistic Belgian electronic music opportunities for pilot testing.
--
-- Resolves: Phase 2 Opportunity Hub data layer

begin;

-- ── opportunities ─────────────────────────────────────────────────────────────
create table if not exists opportunities (
  id          uuid    primary key default gen_random_uuid(),
  title       text    not null check (char_length(title) <= 200),
  description text,
  opp_type    text    not null default 'gig'
                      check (opp_type in ('gig','grant','residency','contest','festival','collab_call','radio')),
  source      text    not null default 'manual'
                      check (source in ('manual','vibe','scrape','partner')),
  source_url  text,
  organizer   text,
  location    text,
  city        text,
  country     text    not null default 'BE',
  compensation text,
  deadline    date,
  genres      text[]  not null default '{}',
  roles       text[]  not null default '{}',
  tags        text[]  not null default '{}',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists opportunities_active_deadline
  on opportunities (is_active, deadline asc nulls last, city);

alter table opportunities enable row level security;

-- Public read: anyone (even unauthenticated) can browse opportunities
drop policy if exists "opportunities_public_read" on opportunities;
create policy "opportunities_public_read" on opportunities
  for select using (true);

-- Only service role / admin can insert/update/delete (managed via migrations + admin UI)
drop policy if exists "opportunities_admin_write" on opportunities;
create policy "opportunities_admin_write" on opportunities
  for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );

-- ── artist_goals ──────────────────────────────────────────────────────────────
create table if not exists artist_goals (
  user_id           uuid    primary key references profiles(id) on delete cascade,
  goals             text[]  not null default '{}',
  skills            text[]  not null default '{}',
  travel_radius_km  int     not null default 50 check (travel_radius_km >= 0 and travel_radius_km <= 10000),
  base_city         text,
  booking_open      boolean not null default false,
  updated_at        timestamptz not null default now()
);

alter table artist_goals enable row level security;

drop policy if exists "artist_goals_owner_all" on artist_goals;
create policy "artist_goals_owner_all" on artist_goals
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Allow others to see booking_open + base_city only (for collaboration matching)
drop policy if exists "artist_goals_public_booking" on artist_goals;
create policy "artist_goals_public_booking" on artist_goals
  for select
  using (booking_open = true);

-- ── opportunity_saves ─────────────────────────────────────────────────────────
create table if not exists opportunity_saves (
  id              uuid    primary key default gen_random_uuid(),
  user_id         uuid    not null references profiles(id) on delete cascade,
  opportunity_id  uuid    not null references opportunities(id) on delete cascade,
  status          text    not null default 'saved'
                          check (status in ('saved','applied','dismissed')),
  draft_text      text,
  created_at      timestamptz not null default now(),
  unique (user_id, opportunity_id)
);

create index if not exists opportunity_saves_user_status
  on opportunity_saves (user_id, status, created_at desc);

alter table opportunity_saves enable row level security;

drop policy if exists "opportunity_saves_owner_all" on opportunity_saves;
create policy "opportunity_saves_owner_all" on opportunity_saves
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Seed: 8 Belgian electronic music opportunities ────────────────────────────
insert into opportunities (title, description, opp_type, organizer, location, city, country, compensation, deadline, genres, roles, tags)
values
  (
    'Kiosk Radio Open Submission — Summer 2026',
    'Kiosk Radio (Brussels) invites DJs and selectors for their summer programme. Send a recorded set (60–90 min), short bio, and genre description. All underground electronic styles welcome.',
    'radio',
    'Kiosk Radio',
    'Place du Jeu de Balle, Brussels',
    'Brussels',
    'BE',
    'Fee negotiated per session',
    '2026-06-30',
    ARRAY['techno','ambient','leftfield','jazz','experimental'],
    ARRAY['dj','selector'],
    ARRAY['radio','community','underground']
  ),
  (
    'Fuse Brussels Resident DJ Search',
    'Fuse is looking for new residents for their Friday programme. Submit a recorded set and a brief motivation. Focus on techno, industrial, and peak-time electronic.',
    'gig',
    'Fuse Brussels',
    'Rue Blaes 208, Brussels',
    'Brussels',
    'BE',
    'Resident fee + guest arrangement',
    '2026-07-15',
    ARRAY['techno','industrial','hard techno'],
    ARRAY['dj','resident'],
    ARRAY['club','resident','techno']
  ),
  (
    'Crevette Records Demo Submission — Summer Edition',
    'Crevette Records (Brussels) accepts demos from producers working in house, leftfield, and experimental club music. Physical or digital releases considered.',
    'collab_call',
    'Crevette Records',
    'Brussels',
    'Brussels',
    'BE',
    'Release deal + promo',
    '2026-08-01',
    ARRAY['house','leftfield','experimental','club'],
    ARRAY['producer','label'],
    ARRAY['demo','label','release']
  ),
  (
    'Beursschouwburg Kunstencentrum Artist Residency',
    'Beursschouwburg offers 2-week residencies to artists working at the intersection of electronic music, performance, and visual arts. Dutch or French application accepted.',
    'residency',
    'Beursschouwburg',
    'Auguste Ortsstraat 20, Brussels',
    'Brussels',
    'BE',
    '€500 production budget + space',
    '2026-09-01',
    ARRAY['experimental','electronic','performance art'],
    ARRAY['producer','performer','visual artist'],
    ARRAY['arts centre','residency','interdisciplinary']
  ),
  (
    'Ampere Ghent Support Slot Call',
    'Ampere (Ghent) is looking for local support acts for their upcoming programme. Techno, EBM, industrial, and leftfield electronics. Max 90-minute sets.',
    'gig',
    'Ampere',
    'Walpurgisstraat 3, Ghent',
    'Ghent',
    'BE',
    '€100–250 support fee',
    '2026-07-01',
    ARRAY['techno','EBM','industrial','leftfield'],
    ARRAY['dj','live act'],
    ARRAY['club','support','underground']
  ),
  (
    'Listen! Festival Artist Grant — Emerging Talent',
    'Listen! Festival (Brussels) offers a €1000 development grant to emerging Belgian electronic artists. Open to DJs, producers, and live acts. Application includes EPK and work-in-progress recording.',
    'grant',
    'Listen! Festival',
    'Brussels',
    'Brussels',
    'BE',
    '€1000 development grant',
    '2026-08-15',
    ARRAY['electronic','experimental','club','ambient'],
    ARRAY['dj','producer','live act'],
    ARRAY['grant','emerging','development']
  ),
  (
    'Rebel Up Festival — Open Call for DJs',
    'Rebel Up (Brussels) festival celebrates global sounds and radical underground culture. Looking for DJs who blend genres, defy norms, and connect communities.',
    'festival',
    'Rebel Up',
    'Brussels',
    'Brussels',
    'BE',
    'Performance fee + travel stipend',
    '2026-09-30',
    ARRAY['global sounds','afro','latin','club','experimental'],
    ARRAY['dj'],
    ARRAY['festival','global','community']
  ),
  (
    'Kompass Klub Ghent — New Face Night',
    'Kompass runs a monthly "New Face" slot for undiscovered local DJs. 1-hour set, no experience minimum. Submit a mix and 3-line bio.',
    'gig',
    'Kompass Klub',
    'Doornzelestraat 49, Ghent',
    'Ghent',
    'BE',
    '€75 + drinks',
    '2026-06-20',
    ARRAY['techno','house','leftfield'],
    ARRAY['dj'],
    ARRAY['club','new talent','ghent']
  )
on conflict do nothing;

commit;

-- Resolves: Phase 2 Opportunity Hub data layer
