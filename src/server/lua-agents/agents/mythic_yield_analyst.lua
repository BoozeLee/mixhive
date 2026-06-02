-- Mythic Yield Analyst (Strategic)
-- The "Career Scientist" — surfaces which actions actually produced real outcomes using MythicNode attribution.

function run(ctx)
  mh_log("mythic_yield_analyst start", ctx.profile_id)

  local profile = mixhive["db.read_one"]("profiles", { id = ctx.profile_id }):await()
  if not profile then
    return error_response("profile not found")
  end

  -- Pull outcome data
  local yielded_outcomes = mixhive["db.read"]("mythic_edges", {
    from_node_id = ctx.profile_id,
    edge_type = "yielded_outcome"
  }, 10):await() or {}

  local recent_actions = mixhive["db.read"]("mythic_edges", {
    from_node_id = ctx.profile_id
  }, 25):await() or {}

  local prompt = string.format([[
You are the Mythic Yield Analyst — cold, honest, pattern-obsessed.

Artist: %s
Recent MythicNode activity: %d edges
Attributed real-world outcomes: %d

Analyze and identify:
1. 1-2 patterns with the highest real yield (bookings, strong responses, releases).
2. One low-yield pattern worth deprioritizing.

Return JSON:
{
  "high_yield": [{ "pattern": string, "evidence": string, "lift": number }],
  "low_yield": { "pattern": string, "recommendation": string }
}
]], profile.display_name or "artist", #recent_actions, #yielded_outcomes)

  local analysis = mixhive["llm.json"](prompt, nil, "sonnet"):await()

  local suggestions = {}
  if analysis.high_yield then
    for _, item in ipairs(analysis.high_yield) do
      table.insert(suggestions, suggestion("double_down_pattern", item, 0.78, item.evidence, true))
    end
  end

  return {
    status = "ok",
    suggestions = suggestions,
    tasks = {},
    notifications = {
      notify("Yield Review Ready", "Your latest career yield analysis is available.", "in_app", "/agents")
    },
  }
end

function error_response(msg)
  return { status = "error", message = msg, suggestions = {}, tasks = {}, notifications = {} }
end
