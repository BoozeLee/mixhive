-- Mythic Collab Weaver Agent (Strategic)
-- Finds high-yield collaboration opportunities using MythicNode graph triangles + historical yield.

function run(ctx)
  mh_log("mythic_collab_weaver start", ctx.profile_id)

  local profile = mixhive["db.read_one"]("profiles", { id = ctx.profile_id }):await()
  if not profile then
    return error_response("profile not found")
  end

  -- Pull graph signals
  local recent_collabs = mixhive["db.read"]("mythic_edges", {
    from_node_id = ctx.profile_id,
    edge_type = "collab_with"
  }, 10):await() or {}

  local recent_venues = mixhive["db.read"]("mythic_edges", {
    from_node_id = ctx.profile_id,
    edge_type = "performed_at"
  }, 12):await() or {}

  local prompt = string.format([[
You are the Mythic Collab Weaver — a strategic matchmaker that uses real graph data.

Artist: %s (genres: %s, location: %s)
Recent collabs logged: %d
Recent venues performed at: %d

Propose 2-3 high-potential collab missions.
Prioritize artists with:
- Shared venue history (strong signal)
- Complementary audience/engagement patterns
- Historical conversion into releases or joint gigs for similar profiles

Return JSON:
{
  "collab_missions": [
    {
      "target_artist_name": string,
      "rationale": string,
      "suggested_first_move": string,
      "confidence": number
    }
  ]
}
]], profile.display_name or "artist", table.concat(profile.genres or {}, ", "), profile.location or "unknown", #recent_collabs, #recent_venues)

  local result = mixhive["llm.json"](prompt, nil, "sonnet"):await()

  local suggestions = {}
  for _, m in ipairs(result.collab_missions or {}) do
    table.insert(suggestions, suggestion(
      "mythic_collab_mission",
      m,
      m.confidence or 0.68,
      m.rationale,
      true
    ))
  end

  -- Web3 branch: propose quest backing for active quests with no collection yet
  local quests = mixhive["db.read"]("quests", { owner_id = ctx.profile_id, status = "active" }, 3):await() or {}
  for _, q in ipairs(quests) do
    local existing = mixhive["db.read"]("nft_collections", {
      owner_id = ctx.profile_id, quest_id = q.id
    }, 1):await() or {}
    if #existing == 0 then
      table.insert(suggestions, suggestion(
        "web3_proposal",
        {
          action = "open_quest_backing",
          source_type = "quest",
          source_id = q.id,
          reason_template = "Your quest has engaged followers — consider opening it for backing.",
          estimated_supply = 20,
          context_stats = { quest_title = q.title or "?" }
        },
        0.7,
        "Active quest '" .. (q.title or "?") .. "' has no backing collection",
        true
      ))
      break
    end
  end

  return {
    status = "ok",
    suggestions = suggestions,
    tasks = {},
    notifications = {},
  }
end

function error_response(msg)
  return { status = "error", message = msg, suggestions = {}, tasks = {}, notifications = {} }
end
