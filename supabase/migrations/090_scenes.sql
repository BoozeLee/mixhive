-- Migration 090: Scene Pages (persistent scene communities + label partners)
--
-- WHY: Basecamp Phase 17 "Scene pages" and "label/collective partnerships" were
-- only prototyped (in-memory FastAPI quest-engine + orphaned UI hitting localhost).
-- This ships them natively on Supabase as the single source of truth: `scenes` and
-- `scene_partners` tables with public-read RLS, plus read-only RPCs that rank real
-- `profiles` into per-scene artist listings, reusing xp/reputation and a salvaged
-- badge-tier model (bronze/silver/gold/platinum at 0/250/750/1200 XP).
--
-- Resolves: Phase 17 (Scene Expansion) — 9969624795, 9969624799

begin;

-- Scenes (persistent community pages)
create table if not exists public.scenes (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  city          text,
  country       text,
  genre         text,
  description   text,
  hero_image_url text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Label / collective co-branded partners per scene
create table if not exists public.scene_partners (
  id          uuid primary key default gen_random_uuid(),
  scene_id    uuid not null references public.scenes(id) on delete cascade,
  name        text not null,
  slug        text not null,
  logo_url    text,
  url         text,
  verified    boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (scene_id, slug)
);

create index if not exists idx_scenes_active on public.scenes(is_active);
create index if not exists idx_scene_partners_scene on public.scene_partners(scene_id);

-- updated_at trigger
create or replace function public.scenes_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists trg_scenes_updated_at on public.scenes;
create trigger trg_scenes_updated_at before update on public.scenes
  for each row execute function public.scenes_set_updated_at();

-- RLS: public read (active scenes), admin write
alter table public.scenes enable row level security;
alter table public.scene_partners enable row level security;

drop policy if exists "scenes_public_read" on public.scenes;
create policy "scenes_public_read" on public.scenes
  for select to anon, authenticated
  using (is_active or exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and coalesce(p.is_admin, false)
  ));

drop policy if exists "scenes_admin_write" on public.scenes;
create policy "scenes_admin_write" on public.scenes
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and coalesce(p.is_admin, false)))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and coalesce(p.is_admin, false)));

drop policy if exists "scene_partners_public_read" on public.scene_partners;
create policy "scene_partners_public_read" on public.scene_partners
  for select to anon, authenticated
  using (exists (
    select 1 from public.scenes s
    where s.id = scene_partners.scene_id
      and (s.is_active or exists (
        select 1 from public.profiles p where p.id = (select auth.uid()) and coalesce(p.is_admin, false)))
  ));

drop policy if exists "scene_partners_admin_write" on public.scene_partners;
create policy "scene_partners_admin_write" on public.scene_partners
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and coalesce(p.is_admin, false)))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and coalesce(p.is_admin, false)));

-- Salvaged badge-tier model
create or replace function public.scene_tier(p_xp int)
returns text language sql immutable as $$
  select case
    when coalesce(p_xp, 0) >= 1200 then 'platinum'
    when coalesce(p_xp, 0) >= 750  then 'gold'
    when coalesce(p_xp, 0) >= 250  then 'silver'
    else 'bronze'
  end;
$$;

-- Ranked artists for a scene. SECURITY DEFINER so anon can read public scene
-- listings, but returns ONLY public-safe profile fields (never email/stripe/etc.).
create or replace function public.get_scene_listings(p_slug text)
returns table (
  user_id uuid, username text, display_name text, avatar_url text,
  xp int, reputation numeric, badge text, verified boolean
)
language sql stable security definer set search_path = public as $$
  select pr.id, pr.username, pr.display_name, pr.avatar_url,
         coalesce(pr.xp, 0), coalesce(pr.reputation_score, 0),
         public.scene_tier(pr.xp), coalesce(pr.verified, false)
  from public.scenes s
  join public.profiles pr
    on ((s.city is not null and pr.location ilike '%' || s.city || '%')
        or (s.genre is not null and pr.genres @> array[s.genre]))
  where s.slug = p_slug and s.is_active and coalesce(pr.is_dj, false)
  order by coalesce(pr.reputation_score, 0) desc, coalesce(pr.xp, 0) desc
  limit 50;
$$;

create or replace function public.get_scene_partners(p_slug text)
returns table (id uuid, name text, slug text, logo_url text, url text, verified boolean)
language sql stable security definer set search_path = public as $$
  select sp.id, sp.name, sp.slug, sp.logo_url, sp.url, sp.verified
  from public.scenes s
  join public.scene_partners sp on sp.scene_id = s.id
  where s.slug = p_slug and s.is_active
  order by sp.verified desc, sp.name;
$$;

grant execute on function public.scene_tier(int) to anon, authenticated;
grant execute on function public.get_scene_listings(text) to anon, authenticated;
grant execute on function public.get_scene_partners(text) to anon, authenticated;

-- Seed initial scenes (artist listings come from real profiles)
insert into public.scenes (slug, name, city, country, genre, description) values
  ('techno-brussels', 'Techno Brussels', 'Brussels', 'Belgium', 'Techno', 'The Brussels techno underground — artists, labels and collectives.'),
  ('amsterdam-techno', 'Amsterdam Techno', 'Amsterdam', 'Netherlands', 'Techno', 'Amsterdam''s techno scene — artists, labels and collectives.')
on conflict (slug) do nothing;

commit;

-- Resolves: Phase 17 (Scene Expansion) — 9969624795, 9969624799
