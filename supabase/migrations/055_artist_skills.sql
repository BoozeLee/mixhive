-- Migration 055: artist_skills — structured skills table
--
-- Extracts the skills[] array from artist_goals into a first-class table so
-- that collaboration_match and opportunity_match agents can query by skill
-- category and proficiency level. Includes a backfill from existing rows.
--
-- Resolves: Phase 2 data architecture — agent-queryable skills table

begin;

create table if not exists public.artist_skills (
  id               bigint generated always as identity primary key,
  user_id          uuid not null references public.profiles(id) on delete cascade,
  skill_name       text not null,
  skill_category   text not null default 'other'
                     check (skill_category in (
                       'instrument', 'production', 'software',
                       'performance', 'visual', 'other'
                     )),
  proficiency_level text not null default 'intermediate'
                     check (proficiency_level in (
                       'beginner', 'intermediate', 'advanced', 'expert'
                     )),
  verified_by      uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),

  unique (user_id, skill_name)
);

create index if not exists idx_artist_skills_user
  on public.artist_skills (user_id);

create index if not exists idx_artist_skills_category
  on public.artist_skills (skill_category);

alter table public.artist_skills enable row level security;

drop policy if exists "artist_skills_owner_all" on public.artist_skills;
create policy "artist_skills_owner_all"
  on public.artist_skills for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "artist_skills_public_read" on public.artist_skills;
create policy "artist_skills_public_read"
  on public.artist_skills for select
  using (true);

drop policy if exists "artist_skills_service_all" on public.artist_skills;
create policy "artist_skills_service_all"
  on public.artist_skills for all
  using  (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Backfill: migrate skills[] arrays from artist_goals → artist_skills rows.
-- Runs idempotently — ON CONFLICT DO NOTHING skips duplicates.
insert into public.artist_skills (user_id, skill_name, skill_category)
select
  user_id,
  trim(skill),
  'other'
from
  public.artist_goals,
  unnest(skills) as skill
where
  array_length(skills, 1) > 0
  and trim(skill) <> ''
on conflict (user_id, skill_name) do nothing;

-- Resolves: Phase 2 data architecture — agent-queryable skills table
commit;
