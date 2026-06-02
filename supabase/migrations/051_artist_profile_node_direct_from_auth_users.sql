-- Migration 051: Direct artist_profile mythic node creation from auth.users
--
-- This is the "belt + suspenders" hardening on top of migration 049.
-- Creates the canonical 'artist_profile' mythic_nodes row *directly* from
-- the auth.users insert, as early as possible in the user lifecycle.
--
-- Why this exists:
-- Migration 049 triggers on public.profiles (after handle_new_user).
-- This trigger on auth.users runs even earlier and is fully independent.
-- Combined with the defensive fallback inside log_performance (049),
-- we now have three layers of protection against missing artist_profile nodes.
--
-- Idempotent: Uses ON CONFLICT DO NOTHING.
-- Security: SECURITY DEFINER + search_path.
--
-- Resolves: Remaining "Artist Profile Node Assumption" robustness (Super Engineer audit)

begin;

-- ============================================
-- 1. Function: Create artist_profile node directly from auth.users
-- ============================================
create or replace function public.handle_new_user_create_artist_profile_node()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Create the artist_profile node in the Mythic graph (idempotent)
  insert into public.mythic_nodes (
    node_type,
    owner_id,
    title,
    payload,
    source_table,
    source_id
  )
  values (
    'artist_profile',
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      new.email,
      'Artist ' || substr(new.id::text, 1, 8)
    ),
    jsonb_build_object(
      'username', new.raw_user_meta_data ->> 'preferred_username',
      'email', new.email,
      'created_via', 'auth.users direct trigger (051)'
    ),
    'auth.users',
    new.id::text
  )
  on conflict (owner_id) where node_type = 'artist_profile' do nothing;

  return new;
end;
$$;

-- ============================================
-- 2. Trigger on auth.users (runs after the existing handle_new_user)
-- ============================================
drop trigger if exists on_auth_user_created_create_artist_profile_node on auth.users;

create trigger on_auth_user_created_create_artist_profile_node
  after insert on auth.users
  for each row
  execute function public.handle_new_user_create_artist_profile_node();

-- ============================================
-- 3. One-time backfill for existing users (run manually if needed)
-- ============================================
-- This is intentionally commented. Run it in the Supabase SQL editor
-- if you have old users who signed up before this migration.
--
-- insert into public.mythic_nodes (node_type, owner_id, title, payload, source_table, source_id)
-- select
--   'artist_profile',
--   u.id,
--   coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', u.email, 'Artist'),
--   jsonb_build_object(
--     'username', u.raw_user_meta_data ->> 'preferred_username',
--     'email', u.email,
--     'backfilled_by', 'migration 051'
--   ),
--   'auth.users',
--   u.id::text
-- from auth.users u
-- where not exists (
--   select 1 from public.mythic_nodes m
--   where m.owner_id = u.id and m.node_type = 'artist_profile'
-- )
-- on conflict (owner_id) where node_type = 'artist_profile' do nothing;

commit;
