-- Migration 031: Press kit layer.
--
-- EPKs are generated from verified MIXHIVE profile/mix data only. The AI/agent
-- layer can suggest copy, but the stored press kit remains owner-controlled and
-- public only when explicitly published.

begin;

create table if not exists press_kits (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  public_slug text not null unique check (public_slug ~ '^[a-z0-9][a-z0-9-]{2,80}$'),
  version int not null default 1,
  title text not null,
  content jsonb not null default '{}',
  pdf_url text,
  is_public boolean not null default false,
  view_count int not null default 0 check (view_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists press_kits_owner_updated_idx
  on press_kits (owner_id, updated_at desc);

create index if not exists press_kits_public_slug_idx
  on press_kits (public_slug)
  where is_public = true;

alter table press_kits enable row level security;

drop policy if exists "press_kits_owner_all" on press_kits;
create policy "press_kits_owner_all" on press_kits
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "press_kits_public_read" on press_kits;
create policy "press_kits_public_read" on press_kits
  for select
  using (is_public = true);

create or replace function update_press_kits_updated_at()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;

create or replace function increment_press_kit_view_count(p_slug text)
  returns void language sql security definer set search_path = public as $$
  update press_kits
  set view_count = view_count + 1
  where public_slug = p_slug
    and is_public = true;
$$;

drop trigger if exists press_kits_updated_at on press_kits;
create trigger press_kits_updated_at
  before update on press_kits
  for each row execute function update_press_kits_updated_at();

commit;
