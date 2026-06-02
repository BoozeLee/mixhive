-- Mythic Agent: Scene Orbit
-- Persona: Strategic Scene Navigator
--
-- Purpose:
--   Maintains a time-bounded "quest" for the creator to gain traction in a
--   specific local or micro scene (e.g. "Brussels Melodic Techno 90-day orbit").
--
-- Trigger recommendations:
--   - on_schedule (weekly or bi-weekly)
--   - manual (user forces a refresh)
--   - After certain opportunity saves or high-engagement events (future)
--
-- Safety:
--   - Never posts publicly or follows anyone automatically.
--   - Only proposes actions via mh.propose_action / quest updates.
--   - All suggestions must include clear provenance (which nodes/edges drove it).

local SCENE_TAGS = {"techno", "leftfield", "brussels"}   -- Customize per quest
local RADIUS_KM = 120
local QUEST_TITLE = "Break into the Brussels Melodic / Leftfield Techno Scene — 90 Day Orbit"

-- Helper: get or create the canonical quest for this owner
local function ensure_active_quest()
  local quests = mh.get_active_quests() or {}
  for _, q in ipairs(quests) do
    if string.find(string.lower(q.title or ""), "brussels") then
      return q
    end
  end

  -- No suitable quest exists — propose creating one
  local new_quest_id = mh.propose_quest({
    title = QUEST_TITLE,
    target_scene_tags = SCENE_TAGS,
    timeframe_days = 90,
    description = "Build real relationships and proof in the Brussels underground electronic scene through strategic plays, collabs, and visibility."
  })

  mh.print("Proposed new Scene Orbit quest: " .. QUEST_TITLE)
  return { id = new_quest_id, is_new = true }
end

-- Main weekly / manual pass
function on_schedule(event)
  local quest = ensure_active_quest()
  if not quest then return end

  -- Pull recent personal + graph activity
  local recent = mh.get_recent_graph_activity(mh.owner_id, 45) or {}
  local nearby = mh.query_mythic_graph({
    center = mh.owner_id,
    node_types = {"artist_profile", "venue", "event", "opportunity"},
    edge_types = {"performed_at", "engaged_with", "collab_with", "submitted_to"},
    max_hops = 2,
    window_days = 120,
    within_km = RADIUS_KM,
    scene_tags = SCENE_TAGS
  }) or {}

  -- Propose 2-3 high-signal next actions
  local proposals = {}

  -- 1. Relevant venues that similar artists have played
  local venue_targets = mh.get_venues_with_history(SCENE_TAGS, "Brussels", 3) or {}
  for i, v in ipairs(venue_targets) do
    if i > 2 then break end
    table.insert(proposals, {
      type = "venue_target",
      node_id = v.id,
      rationale = "Artists with similar 90-day momentum graphs to yours have played here recently and converted well into follow-up bookings."
    })
  end

  -- 2. High-fit opportunities inside the timeframe
  local opps = mh.get_relevant_opportunities_for_quest(quest.id) or {}
  for i, o in ipairs(opps) do
    if i > 2 then break end
    table.insert(proposals, {
      type = "opportunity",
      node_id = o.id,
      rationale = "Strong genre + geography overlap with your current quest. " .. (o.deadline and ("Deadline: " .. o.deadline) or "Rolling deadline.")
    })
  end

  -- 3. Artists for strategic listening / light outreach (collab-adjacent)
  local similar = mh.get_similar_artists_in_scene(mh.owner_id, SCENE_TAGS, RADIUS_KM, 5) or {}
  for i, a in ipairs(similar) do
    if i > 3 then break end
    if not a.already_strong_connection then
      table.insert(proposals, {
        type = "artist_listen",
        node_id = a.id,
        rationale = "Strong listener overlap + shared recent venue history. Good candidate for mutual support or future collab."
      })
    end
  end

  -- Surface proposals through the normal Mythic suggestion channel
  for _, p in ipairs(proposals) do
    mh.propose_action(p.type, p.node_id, p.rationale, quest.id)
    mh.create_recommended_by_agent_edge(p.node_id, quest.id, {
      agent_persona = "Scene Orbit",
      confidence = 0.78
    })
  end

  -- Update quest momentum (very lightweight heuristic for Phase 6)
  local momentum = math.min(95, 40 + (#recent * 3) + (#nearby * 1.5))
  mh.update_quest_momentum(quest.id, momentum)

  mh.print(string.format("Scene Orbit pass complete. %d proposals. Momentum now ~%.0f", #proposals, momentum))
end

-- Allow manual test runs
function manual(event)
  on_schedule(event)
end