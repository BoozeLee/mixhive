-- Mythic Scene Orbit Agent (Strategic)
-- Maintains long-term career quests and proposes high-signal actions using the MythicNode graph.

function run(ctx)
  mh_log("mythic_scene_orbit start", ctx.profile_id)

  local profile = mixhive["db.read_one"]("profiles", { id = ctx.profile_id }):await()
  if not profile then
    return error_response("profile not found")
  end

  -- Rich MythicNode context (strategic agents can query these tables)
  local recent_performances = mixhive["db.read"]("mythic_edges", {
    from_node_id = ctx.profile_id,
    edge_type = "performed_at"
  }, 20):await() or {}

  local recent_submissions = mixhive["db.read"]("mythic_edges", {
    from_node_id = ctx.profile_id,
    edge_type = "submitted_to"
  }, 15):await() or {}

  local active_quests = mixhive["db.read"]("quests", {
    owner_id = ctx.profile_id,
    status = "active"
  }, 3):await() or {}

  local quest_context = ""
  if #active_quests > 0 then
    local q = active_quests[1]
    local milestones = mixhive["db.read"]("quest_milestones", { quest_id = q.id }, 8):await() or {}
    quest_context = string.format('Active Quest: "%s" (momentum: %s, %d milestones)',
      q.title, q.momentum or "?", #milestones)
  end

  local prompt = string.format([[
You are the Mythic Scene Orbit strategic agent — a calm, data-driven career navigator for underground electronic creators.

Artist: %s
Location: %s
Genres: %s

Recent MythicNode signals (last 12 months):
- Real performances logged: %d
- Opportunity submissions: %d
- %s

Your job:
- If they have an active scene-focused quest, propose 2-3 high-leverage next actions (specific venues, promoters, or micro-collabs with historical yield for similar artists in that scene).
- If no strong active quest exists, recommend one high-potential focus area right now.
- Ground every suggestion in actual graph data (shared venues, overlapping success patterns, etc.).

Return strict JSON only:
{
  "recommended_focus": string,
  "actions": [
    {
      "title": string,
      "rationale": string,
      "target_type": "venue" | "opportunity" | "artist" | "collab",
      "confidence": number (0.0-1.0)
    }
  ]
}

Tone: insider, precise, anti-hype. Max 2-3 actions.
]], 
    profile.display_name or "Artist",
    profile.location or "unknown",
    table.concat(profile.genres or {}, ", "),
    #recent_performances,
    #recent_submissions,
    quest_context ~= "" and quest_context or "No active scene quest currently"
  )

  local plan = mixhive["llm.json"](prompt, nil, "sonnet"):await()

  local suggestions = {}
  local notifications = {}

  for _, action in ipairs(plan.actions or {}) do
    table.insert(suggestions, suggestion(
      "mythic_scene_action",
      action,
      action.confidence or 0.72,
      action.rationale,
      true
    ))
  end

  if plan.recommended_focus then
    table.insert(notifications, notify(
      "Scene Orbit Focus",
      plan.recommended_focus,
      "in_app",
      "/agents"
    ))
  end

  return {
    status = "ok",
    suggestions = suggestions,
    tasks = {},
    notifications = notifications,
  }
end

function error_response(msg)
  return {
    status = "error",
    message = msg,
    suggestions = {},
    tasks = {},
    notifications = {},
  }
end