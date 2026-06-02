-- Migration 058: external_links — structured social/platform links per profile
--
-- profiles.social_links is an unstructured JSONB blob that agents cannot
-- easily query. This table provides one row per provider per user, enabling
-- scene_radar, label_scout, and press_kit agents to fetch verified platform
-- handles and follower counts. The original social_links column is kept for
-- backward compatibility; agents should prefer this table.
--
-- Resolves: Phase 2 data architecture — provider-structured external links

begin;

create table if not exists public.external_links (
  id               bigint generated always as identity primary key,
  user_id          uuid not null references public.profiles(id) on delete cascade,
  provider         text not null
                     check (provider in (
                       'soundcloud', 'bandcamp', 'resident_advisor',
                       'spotify', 'apple_music', 'beatport', 'mixcloud',
                       'youtube', 'instagram', 'tiktok', 'facebook',
                       'vibe', 'discogs', 'other'
                     )),
  url              text not null,
  handle           text,
  is_verified      boolean not null default false,
  follower_count   int,
  last_synced_at   timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  unique (user_id, provider)
);

create index if not exists idx_external_links_user
  on public.external_links (user_id);

create index if not exists idx_external_links_provider
  on public.external_links (provider);

alter table public.external_links enable row level security;

drop policy if exists "external_links_public_read" on public.external_links;
create policy "external_links_public_read"
  on public.external_links for select
  using (true);

drop policy if exists "external_links_owner_write" on public.external_links;
create policy "external_links_owner_write"
  on public.external_links for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "external_links_service_all" on public.external_links;
create policy "external_links_service_all"
  on public.external_links for all
  using  (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Resolves: Phase 2 data architecture — provider-structured external links
commit;
