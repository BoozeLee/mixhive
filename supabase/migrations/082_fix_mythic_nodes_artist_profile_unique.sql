-- Migration 082: Add missing partial unique index on mythic_nodes for artist_profile
--
-- The trigger handle_new_user_create_artist_profile_node uses:
--   ON CONFLICT (owner_id) WHERE node_type = 'artist_profile' DO NOTHING
-- PostgreSQL requires an exact partial unique index to match that clause.
-- Without it every new user signup throws "Database error saving new user".
-- This index makes the conflict target valid and idempotent.
--
-- Resolves: signup "Database error saving new user"

begin;

create unique index if not exists mythic_nodes_artist_profile_per_owner
  on public.mythic_nodes (owner_id)
  where node_type = 'artist_profile';

commit;

-- Resolves: signup "Database error saving new user"
