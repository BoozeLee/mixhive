-- Mythic Strategist (Strategic)
-- Weekly strategy pass: reads the MythicNode graph, surfaces 3 collab targets,
-- 3 venue/promoter approaches, and 2 content ideas.  Outputs structured JSON
-- for the UI to render as an actionable weekly brief.

function run(ctx)
  mh_log("mythic_strategist start", ctx.profile_id)

  local profile = mixhive["db.read_one"]("profiles", { id = ctx.profile_id }):await()
  if not profile then
    return { status = "error", message = "profile not found",
             suggestions = {}, tasks = {}, notifications = {} }
  end

  -- Graph: similar artists (collab candidates)
  local similar = mixhive["mythic.graph.query"]({
    root_id   = ctx.profile_id,
    edge_type = "similar_artist",
    depth     = 1,
    limit     = 10,
  }):await() or {}

  -- Active quests to anchor suggestions
  local quests = mixhive["mythic.quest.get_active"](ctx.profile_id):await() or {}
  local quest_summary = {}
  for _, q in ipairs(quests) do
    table.insert(quest_summary, q.title or "")
  end

  -- Open opportunities (gigs + venues)
  local opps = mixhive["db.read"]("opportunities", { is_active = true }, 20):await() or {}
  local venue_opps = {}
  for _, o in ipairs(opps) do
    if o.opp_type == "gig" or o.opp_type == "festival" or o.opp_type == "residency" then
      table.insert(venue_opps, o)
    end
    if #venue_opps >= 10 then break end
  end

  local collab_names = {}
  for i, n in ipairs(similar) do
    if i > 5 then break end
    table.insert(collab_names, (n.display_name or n.username or n.id or "?"))
  end

  local opp_lines = {}
  for i, o in ipairs(venue_opps) do
    if i > 8 then break end
    table.insert(opp_lines, string.format("%s (%s, %s)", o.title or "?", o.opp_type or "?", o.city or "?"))
  end

  local prompt = string.format([[
You are the Mythic Strategist, an incisive AI career advisor for underground music creators.

Artist: %s
Bio: %s
Active quests: %s

Graph-similar artists available for collaboration: %s
Open venue/gig opportunities: %s

Return a concise weekly strategy brief as JSON:
{
  "collab_targets":   [{"name": string, "rationale": string, "action": string}],  // 3 items
  "venue_approaches": [{"venue": string, "angle": string, "next_step": string}],  // 3 items
  "content_ideas":    [{"idea": string, "format": string}]                        // 2 items
}
Be direct and specific. Prioritize actions the artist can take THIS week.
]],
    profile.display_name or "artist",
    profile.bio or "no bio",
    table.concat(quest_summary, "; "),
    table.concat(collab_names, ", "),
    table.concat(opp_lines, " | ")
  )

  local brief = mixhive["llm.json"](prompt, nil, "sonnet"):await()

  local suggestions = {}

  local function add_suggestions(list, stype)
    for _, item in ipairs(list or {}) do
      table.insert(suggestions, {
        type              = stype,
        payload           = item,
        confidence        = 0.72,
        rationale         = item.rationale or item.angle or item.idea or "",
        requires_approval = true,
      })
    end
  end

  add_suggestions(brief.collab_targets,   "collab_target")
  add_suggestions(brief.venue_approaches, "venue_approach")
  add_suggestions(brief.content_ideas,    "content_idea")

  -- Store brief in the graph as a recommended_by_agent edge for each collab target
  for _, item in ipairs(brief.collab_targets or {}) do
    local target = nil
    for _, n in ipairs(similar) do
      if (n.display_name or n.username or "") == (item.name or "") then
        target = n
        break
      end
    end
    if target and target.id then
      mixhive["mythic.edge.create"]({
        from_id   = ctx.profile_id,
        to_id     = target.id,
        edge_type = "recommended_by_agent",
        meta      = { agent_id = ctx.agent_id, rationale = item.rationale },
      }):await()
    end
  end

  return {
    status        = "ok",
    suggestions   = suggestions,
    tasks         = {},
    notifications = {
      {
        channel  = "in_app",
        subject  = "Weekly Strategy Brief",
        body     = "Your Mythic Strategist has prepared " .. #suggestions .. " actions for this week.",
        cta_url  = "/agents",
      }
    },
  }
end