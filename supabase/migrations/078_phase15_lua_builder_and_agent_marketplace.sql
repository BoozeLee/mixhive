-- Migration 078: Phase 15 — Lua Builder Definitions + Agent Marketplace
--
-- Adds the no-code Lua builder data model (IR definitions + versioned
-- snapshots) and the agent marketplace catalog tables for discovery,
-- purchase, install, and review of Lua agents.
--
-- New tables: lua_agent_definitions, lua_agent_versions,
--   lua_agent_packages, lua_agent_package_installs,
--   lua_agent_package_reviews
--
-- Resolves: Phase 15 — Quest Marketplace (Lua agent marketplace)

begin;

-- ── 1. Lua agent definitions (no-code builder IR) ────────────────────────────
-- Each row is the mutable "workspace" definition for a user-authored agent.
-- The no-code builder reads/writes the `ir_json` field (block graph JSON).
-- On publish, a snapshot is copied to lua_agent_versions.

create table if not exists public.lua_agent_definitions (
  id                   uuid primary key default gen_random_uuid(),
  owner_profile_id     uuid not null references public.profiles(id) on delete cascade,
  name                 text not null,
  description          text,
  -- Intermediate Representation: JSON block graph produced by the builder UI
  ir_json              jsonb not null default '{"version":1,"blocks":[],"edges":[]}',
  -- Last compiled Lua source (generated from ir_json; null if not compiled yet)
  compiled_lua         text,
  last_compiled_at     timestamptz,
  -- Tools declared by this agent (for safety review + user display)
  tools_used           text[] not null default '{}',
  -- Plain-English summary of what data the agent can read/write
  data_access_summary  text,
  -- Trigger type this definition fires on (mirrors lua_agents.trigger_type)
  trigger_type         text,
  status               text not null default 'draft' check (status in ('draft','published','archived')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_lua_agent_definitions_owner
  on public.lua_agent_definitions(owner_profile_id);
create index if not exists idx_lua_agent_definitions_status
  on public.lua_agent_definitions(status);

-- ── 2. Lua agent versions (immutable snapshots on publish) ───────────────────

create table if not exists public.lua_agent_versions (
  id                    uuid primary key default gen_random_uuid(),
  definition_id         uuid not null references public.lua_agent_definitions(id) on delete cascade,
  owner_profile_id      uuid not null references public.profiles(id) on delete cascade,
  version               text not null,  -- semver, e.g. "1.0.0"
  ir_json_snapshot      jsonb not null,
  compiled_lua_snapshot text not null,
  tools_used            text[] not null default '{}',
  data_access_summary   text,
  changelog             text,
  created_at            timestamptz not null default now(),
  unique (definition_id, version)
);

create index if not exists idx_lua_agent_versions_definition
  on public.lua_agent_versions(definition_id, created_at desc);

-- ── 3. Lua agent packages (marketplace catalog) ──────────────────────────────

create table if not exists public.lua_agent_packages (
  id                   uuid primary key default gen_random_uuid(),
  creator_profile_id   uuid not null references public.profiles(id) on delete cascade,
  -- Points to the versioned snapshot backing this listing
  lua_version_id       uuid references public.lua_agent_versions(id) on delete set null,
  -- Display metadata
  name                 text not null,
  tagline              text,
  description          text,
  category             text not null check (category in (
    'discovery','booking','social_automation','collab_coordinator',
    'visual_brand','quest_automation','analytics','gear_assistant','custom'
  )),
  tags                 text[] not null default '{}',
  discipline_focus     text[] not null default '{}',
  complexity           text not null default 'beginner' check (complexity in (
    'beginner','intermediate','advanced'
  )),
  -- Pricing
  price                numeric(8,2) not null default 0 check (price >= 0),
  currency             char(3) not null default 'EUR',
  license              text not null default 'free_open' check (license in (
    'free_open','free_attribution','paid_personal','paid_commercial'
  )),
  version              text not null default '1.0.0',
  -- User-configurable parameters schema (JSON Schema)
  config_schema        jsonb not null default '{}',
  -- Safety metadata
  tools_used           text[] not null default '{}',
  data_access_summary  text,
  capabilities         text[] not null default '{}',
  screenshot_urls      text[] not null default '{}',
  -- Cached aggregates (updated by triggers / background job)
  install_count        int not null default 0,
  avg_rating           numeric(3,2) not null default 0,
  rating_count         int not null default 0,
  -- Trust badges
  official             boolean not null default false,
  verified             boolean not null default false,
  status               text not null default 'draft' check (status in ('draft','published','retired')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_lua_agent_packages_creator
  on public.lua_agent_packages(creator_profile_id);
create index if not exists idx_lua_agent_packages_published
  on public.lua_agent_packages(category, status) where status = 'published';
create index if not exists idx_lua_agent_packages_official
  on public.lua_agent_packages(official, status) where official = true;
create index if not exists idx_lua_agent_packages_rating
  on public.lua_agent_packages(avg_rating desc) where status = 'published';

-- ── 4. Package installs ──────────────────────────────────────────────────────

create table if not exists public.lua_agent_package_installs (
  id                  uuid primary key default gen_random_uuid(),
  package_id          uuid not null references public.lua_agent_packages(id) on delete cascade,
  profile_id          uuid not null references public.profiles(id) on delete cascade,
  -- The lua_agents instance created on install
  agent_instance_id   uuid references public.lua_agents(id) on delete set null,
  version_installed   text not null,
  -- User-supplied parameter values (from config_schema)
  config              jsonb not null default '{}',
  installed_at        timestamptz not null default now(),
  unique (package_id, profile_id)
);

create index if not exists idx_lua_agent_package_installs_profile
  on public.lua_agent_package_installs(profile_id);
create index if not exists idx_lua_agent_package_installs_package
  on public.lua_agent_package_installs(package_id);

-- ── 5. Package reviews ───────────────────────────────────────────────────────

create table if not exists public.lua_agent_package_reviews (
  id                    uuid primary key default gen_random_uuid(),
  package_id            uuid not null references public.lua_agent_packages(id) on delete cascade,
  reviewer_profile_id   uuid not null references public.profiles(id) on delete cascade,
  rating                smallint not null check (rating between 1 and 5),
  comment               text,
  created_at            timestamptz not null default now(),
  unique (package_id, reviewer_profile_id)
);

create index if not exists idx_lua_agent_package_reviews_package
  on public.lua_agent_package_reviews(package_id);

-- ── 6. Trigger: update avg_rating on package after review insert/update/delete

create or replace function public.refresh_package_rating()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  update public.lua_agent_packages
  set
    avg_rating   = coalesce((
      select avg(rating)::numeric(3,2)
      from public.lua_agent_package_reviews
      where package_id = coalesce(new.package_id, old.package_id)
    ), 0),
    rating_count = (
      select count(*)
      from public.lua_agent_package_reviews
      where package_id = coalesce(new.package_id, old.package_id)
    )
  where id = coalesce(new.package_id, old.package_id);
  return null;
end;
$$;

drop trigger if exists trg_refresh_package_rating_ins
  on public.lua_agent_package_reviews;
create trigger trg_refresh_package_rating_ins
  after insert or update or delete on public.lua_agent_package_reviews
  for each row execute function public.refresh_package_rating();

-- ── 7. Trigger: increment install_count on package ──────────────────────────

create or replace function public.increment_package_install_count()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.lua_agent_packages
    set install_count = install_count + 1
    where id = new.package_id;
  elsif tg_op = 'DELETE' then
    update public.lua_agent_packages
    set install_count = greatest(install_count - 1, 0)
    where id = old.package_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_package_install_count
  on public.lua_agent_package_installs;
create trigger trg_package_install_count
  after insert or delete on public.lua_agent_package_installs
  for each row execute function public.increment_package_install_count();

-- ── 8. updated_at triggers ──────────────────────────────────────────────────

drop trigger if exists set_updated_at on public.lua_agent_definitions;
create trigger set_updated_at
  before update on public.lua_agent_definitions
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.lua_agent_packages;
create trigger set_updated_at
  before update on public.lua_agent_packages
  for each row execute function public.set_updated_at();

-- ── 9. RLS ───────────────────────────────────────────────────────────────────

alter table public.lua_agent_definitions         enable row level security;
alter table public.lua_agent_versions            enable row level security;
alter table public.lua_agent_packages            enable row level security;
alter table public.lua_agent_package_installs    enable row level security;
alter table public.lua_agent_package_reviews     enable row level security;

-- lua_agent_definitions: private to owner
drop policy if exists "Owner manages own definitions" on public.lua_agent_definitions;
create policy "Owner manages own definitions"
  on public.lua_agent_definitions for all
  using (owner_profile_id = auth.uid())
  with check (owner_profile_id = auth.uid());

-- lua_agent_versions: owner + anyone if linked to published package
drop policy if exists "Owner reads own versions" on public.lua_agent_versions;
create policy "Owner reads own versions"
  on public.lua_agent_versions for select
  using (owner_profile_id = auth.uid());

drop policy if exists "Published package versions are public" on public.lua_agent_versions;
create policy "Published package versions are public"
  on public.lua_agent_versions for select
  using (
    exists (
      select 1 from public.lua_agent_packages p
      where p.lua_version_id = lua_agent_versions.id
        and p.status = 'published'
    )
  );

drop policy if exists "Owner manages own versions" on public.lua_agent_versions;
create policy "Owner manages own versions"
  on public.lua_agent_versions for all
  using (owner_profile_id = auth.uid())
  with check (owner_profile_id = auth.uid());

-- lua_agent_packages: published = public read; owner manages
drop policy if exists "Anyone reads published packages" on public.lua_agent_packages;
create policy "Anyone reads published packages"
  on public.lua_agent_packages for select
  using (status = 'published' or creator_profile_id = auth.uid());

drop policy if exists "Creator manages own packages" on public.lua_agent_packages;
create policy "Creator manages own packages"
  on public.lua_agent_packages for all
  using (creator_profile_id = auth.uid())
  with check (creator_profile_id = auth.uid());

-- lua_agent_package_installs
drop policy if exists "Users manage own installs" on public.lua_agent_package_installs;
create policy "Users manage own installs"
  on public.lua_agent_package_installs for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- lua_agent_package_reviews
drop policy if exists "Anyone reads package reviews" on public.lua_agent_package_reviews;
create policy "Anyone reads package reviews"
  on public.lua_agent_package_reviews for select using (true);

drop policy if exists "Users manage own package reviews" on public.lua_agent_package_reviews;
create policy "Users manage own package reviews"
  on public.lua_agent_package_reviews for all
  using (reviewer_profile_id = auth.uid())
  with check (reviewer_profile_id = auth.uid());

-- ── 10. RPCs ─────────────────────────────────────────────────────────────────

-- List published packages with optional filters
create or replace function public.list_agent_packages(
  p_category text default null,
  p_discipline text default null,
  p_free_only boolean default false,
  p_min_rating numeric default null,
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  id uuid, name text, tagline text, category text, discipline_focus text[],
  complexity text, price numeric, license text, capabilities text[],
  tools_used text[], install_count int, avg_rating numeric, rating_count int,
  official boolean, verified boolean, creator_profile_id uuid
)
language sql stable security definer
set search_path = public
as $$
  select
    id, name, tagline, category, discipline_focus, complexity,
    price, license, capabilities, tools_used,
    install_count, avg_rating, rating_count, official, verified, creator_profile_id
  from public.lua_agent_packages
  where status = 'published'
    and (p_category is null or category = p_category)
    and (p_discipline is null or p_discipline = any(discipline_focus))
    and (not p_free_only or price = 0)
    and (p_min_rating is null or avg_rating >= p_min_rating)
  order by
    official desc,
    avg_rating desc,
    install_count desc
  limit p_limit offset p_offset;
$$;

revoke all on function public.list_agent_packages from public;
grant execute on function public.list_agent_packages to authenticated, anon;

-- Install a free agent package (creates lua_agents instance)
create or replace function public.install_agent_package(
  p_package_id uuid,
  p_config jsonb default '{}'
)
returns uuid  -- returns the new lua_agents.id
language plpgsql security definer
set search_path = public
as $$
declare
  v_pkg         public.lua_agent_packages%rowtype;
  v_ver         public.lua_agent_versions%rowtype;
  v_agent_id    uuid;
  v_profile_id  uuid;
begin
  v_profile_id := auth.uid();
  if v_profile_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_pkg from public.lua_agent_packages
  where id = p_package_id and status = 'published';
  if not found then raise exception 'Package not found or not published'; end if;

  if v_pkg.price > 0 then
    raise exception 'Paid packages require payment flow before install';
  end if;

  select * into v_ver from public.lua_agent_versions where id = v_pkg.lua_version_id;

  -- Create the live agent instance
  insert into public.lua_agents (
    owner_id, name, description, script, trigger_type, is_public
  ) values (
    v_profile_id,
    v_pkg.name,
    v_pkg.tagline,
    coalesce(v_ver.compiled_lua_snapshot, '-- placeholder'),
    coalesce(v_pkg.tools_used[1], 'on_schedule'),
    false
  ) returning id into v_agent_id;

  -- Record the install
  insert into public.lua_agent_package_installs (
    package_id, profile_id, agent_instance_id, version_installed, config
  ) values (
    p_package_id, v_profile_id, v_agent_id, v_pkg.version, p_config
  ) on conflict (package_id, profile_id) do update
    set agent_instance_id = v_agent_id,
        version_installed  = excluded.version_installed,
        config             = excluded.config,
        installed_at       = now();

  return v_agent_id;
end;
$$;

revoke all on function public.install_agent_package from public;
grant execute on function public.install_agent_package to authenticated;

-- Build/compile a definition (stub: records timestamp, actual compile in app)
create or replace function public.build_agent_definition(p_definition_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  update public.lua_agent_definitions
  set last_compiled_at = now(), updated_at = now()
  where id = p_definition_id
    and owner_profile_id = auth.uid();
  if not found then
    raise exception 'Definition not found or access denied';
  end if;
end;
$$;

revoke all on function public.build_agent_definition from public;
grant execute on function public.build_agent_definition to authenticated;

commit;

-- Resolves: Phase 15 — Quest Marketplace (Lua agent builder + marketplace)
