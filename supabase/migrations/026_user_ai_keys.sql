-- Migration 026: Per-user AI keys + Pro tier flag.
--
-- AI generation (DALL-E avatar, GPT bio) is user-funded: each user stores their
-- own OpenAI API key, retrieved server-side only via RLS-protected table.
-- Admins get the system key for free.  Pro users get the MixHive-hosted
-- Stable Diffusion endpoint instead, gated by profiles.is_pro.
--
-- The openai_api_key column is never returned to the client in cleartext —
-- server API routes fetch it using the user's own JWT so RLS enforces ownership.
--
-- Resolves: per-user AI key management + paid Pro tier groundwork

begin;

-- ── user_ai_keys ─────────────────────────────────────────────────────────────
create table if not exists user_ai_keys (
  user_id      uuid primary key references profiles(id) on delete cascade,
  openai_api_key text not null check (char_length(openai_api_key) >= 20),
  has_key      boolean generated always as (true) stored,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table user_ai_keys enable row level security;

drop policy if exists "user_ai_keys_self_read"   on user_ai_keys;
drop policy if exists "user_ai_keys_self_write"  on user_ai_keys;

-- Users can read their own row (used by server routes via JWT-scoped client)
create policy "user_ai_keys_self_read" on user_ai_keys
  for select using (auth.uid() = user_id);

-- Users can insert/update/delete their own key
create policy "user_ai_keys_self_write" on user_ai_keys
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Updated-at trigger
drop trigger if exists set_user_ai_keys_updated_at on user_ai_keys;
create or replace function set_user_ai_keys_updated_at()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger set_user_ai_keys_updated_at
  before update on user_ai_keys
  for each row execute function set_user_ai_keys_updated_at();

-- ── profiles: is_pro column ───────────────────────────────────────────────────
alter table profiles add column if not exists is_pro boolean not null default false;

-- ── helper view: does user have a key? (safe to expose to client) ─────────────
-- Returns only the boolean, never the key itself.
drop view if exists user_ai_key_status;
create view user_ai_key_status
  with (security_invoker = true)
  as
  select user_id, has_key, updated_at from user_ai_keys;

commit;

-- Resolves: per-user AI key management
