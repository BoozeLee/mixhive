-- Opportunity Match Agent
-- Matches artist to grants, gigs, open calls, and festivals from ai_suggestions + opportunities table.
-- Trigger: cron:hourly | event:user_request

function run(ctx)
  mh_log("opportunity_match start", ctx.profile_id)

  local profile = mixhive["db.read_one"]("profiles", { id = ctx.profile_id }):await()
  if not profile then return { status = "error", message = "profile not found",
    suggestions = {}, tasks = {}, notifications = {} } end

  -- Load open opportunities
  local opps = mixhive["db.read"]("opportunities", { is_active = true }, 20):await()

  if #opps == 0 then
    mh_log("no active opportunities found")
    return { status = "ok", suggestions = {}, tasks = {}, notifications = {} }
  end

  local suggestions = {}
  local count = 0

  for _, opp in ipairs(opps) do
    if count >= 8 then break end

    local rationale_prompt = string.format([[
In 1 sentence, explain why "%s" (genres: %s, location: %s) fits this opportunity:
"%s" — %s
Be specific. Max 20 words.
]],
      profile.display_name or "this artist",
      table.concat(profile.genres or {}, ", "),
      profile.location or "Belgium",
      opp.title or "opportunity",
      (opp.description or ""):sub(1, 150)
    )

    local rationale = mixhive["llm.call"](rationale_prompt, "haiku"):await()

    table.insert(suggestions, suggestion(
      "opportunity_match",
      {
        opportunity_id = opp.id,
        title          = opp.title,
        opp_type       = opp.opp_type,
        city           = opp.city,
        compensation   = opp.compensation,
        deadline       = opp.deadline,
        source_url     = opp.source_url,
      },
      0.70,
      rationale,
      false
    ))
    count = count + 1
  end

  local notifications = {}
  if #suggestions > 0 then
    table.insert(notifications, notify(
      #suggestions .. " opportunities matched",
      "New gigs, grants, and open calls matched to your profile.",
      "in_app",
      "/agents/inbox"
    ))
  end

  mh_log("done — " .. #suggestions .. " matches")
  return {
    status        = "ok",
    suggestions   = suggestions,
    tasks         = {},
    notifications = notifications,
  }
end
