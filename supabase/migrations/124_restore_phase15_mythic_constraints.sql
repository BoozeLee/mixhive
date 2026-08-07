-- Migration 124: Restore Phase 15 graph types dropped by 119's §6 rewrites.
--
-- Migration 119 replaced the mythic_nodes/mythic_edges CHECK constraints with
-- lists built from the pre-077 shape. That silently removed the 20 types that
-- migration 077 (Phase 15: gear marketplace, collab quests, agent marketplace)
-- legitimately added:
--
--   mythic_edges drops: listed_by, interested_in, sold_to, scene_gear,
--     quest_created_by, quest_requires_role, party_for_quest, role_filled_by,
--     party_member, assisted_by_agent, completed_quest, role_completed_as,
--     agent_created_by, owns_agent, used_in_quest, assistant_for_role,
--     agent_inspired_by
--   mythic_nodes drops: equipment_listing, collab_quest, lua_agent_package
--
-- This migration restores the union of 066 + 077 + 119 types. It is additive
-- (never removes a type), idempotent, and preserves every FK-1 type 119 added
-- (drained_from, germinated_into, flow_spore).
--
-- Resolves: deploy gate from MIXHIVE_SUPER_PROMPT §0 migration audit

begin;

alter table public.mythic_edges drop constraint if exists mythic_edges_edge_type_check;
alter table public.mythic_edges add constraint mythic_edges_edge_type_check
  check (edge_type in (
    'performed_at','booked_by','submitted_to','collab_with','remixed',
    'engaged_with','recommended_by_agent','followed','inspired_by',
    'quest_milestone','yielded_outcome','similar_artist',
    'session_produced_mix','owns_nft_of','backed_by','backed_quest',
    'drained_from','germinated_into',
    'listed_by','interested_in','sold_to','scene_gear',
    'quest_created_by','quest_requires_role','party_for_quest',
    'role_filled_by','party_member','assisted_by_agent',
    'completed_quest','role_completed_as','agent_created_by','owns_agent',
    'used_in_quest','assistant_for_role','agent_inspired_by'
  ));

alter table public.mythic_nodes drop constraint if exists mythic_nodes_node_type_check;
alter table public.mythic_nodes add constraint mythic_nodes_node_type_check
  check (node_type in (
    'artist_profile','mix','buzz','event','venue','opportunity','promoter',
    'label','curator','quest','agent','collab_session','nft_collection',
    'flow_spore',
    'equipment_listing','collab_quest','lua_agent_package'
  ));

commit;
