-- Grant Assistant Agent
-- Scores eligibility for Belgian and EU music grants, drafts application intros.
-- Trigger: event:user_request | cron:weekly

local GRANTS = {
  {
    id          = "sabam_culture",
    name        = "Sabam for Culture",
    org         = "Sabam",
    country     = "BE",
    max_amount  = 5000,
    description = "Supports Belgian creators for cultural projects. Members only.",
    eligibility = "Must be Sabam member. Belgian nationality or residence.",
    url         = "https://www.sabam.be",
  },
  {
    id          = "playright_plus",
    name        = "PlayRight+ Music Video Grant",
    org         = "PlayRight",
    country     = "BE",
    max_amount  = 750,
    description = "Half of production costs (max 750 EUR) for a music video or live session.",
    eligibility = "Must be a PlayRight beneficiary (performer/musician).",
    url         = "https://playright.be",
  },
  {
    id          = "fund_belgian_music",
    name        = "Fund Belgian Music",
    org         = "FACIR / Sabam for Culture / PlayRight+",
    country     = "BE",
    max_amount  = 7500,
    description = "Max 30% of budget, capped at 7500 EUR. Belgian music projects with cultural impact.",
    eligibility = "Belgian professional musician or collective.",
    url         = "https://kbs-frb.be",
  },
  {
    id          = "effea",
    name        = "EFFEA — European Festivals Fund for Emerging Artists",
    org         = "EFFEA",
    country     = "EU",
    max_amount  = 15000,
    description = "Supports emerging artists performing at European festivals.",
    eligibility = "Emerging artist (not yet headline). European nationality or residence.",
    url         = "https://www.effa.info",
  },
}

function run(ctx)
  mh_log("grant_assistant start", ctx.profile_id)

  local profile = mixhive["db.read_one"]("profiles", { id = ctx.profile_id }):await()
  if not profile then return { status = "error", message = "profile not found",
    suggestions = {}, tasks = {}, notifications = {} } end

  local country = (profile.location or ""):match("^(%a+)") or "BE"

  local suggestions  = {}
  local tasks        = {}
  local notifications = {}

  for _, grant in ipairs(GRANTS) do
    if grant.country ~= "EU" and grant.country ~= "BE" then goto continue end

    local score_prompt = string.format([[
Score this artist's eligibility for this grant. Return JSON:
{"score":0-100,"eligible":true/false,"reason":"1 sentence","missing":["item1"]}

Artist: %s | Location: %s | Genres: %s | Bio: %s
Grant: %s | Criteria: %s
]],
      profile.display_name or "Artist",
      profile.location or "unknown",
      table.concat(profile.genres or {}, ", "),
      (profile.bio or ""):sub(1, 200),
      grant.name,
      grant.eligibility
    )

    local elig = mixhive["llm.json"](score_prompt,
      '{"score":number,"eligible":boolean,"reason":string,"missing":["string"]}',
      "haiku"
    ):await()

    mh_log(grant.name .. " score=" .. tostring(elig.score))

    if (elig.score or 0) >= 55 then
      local draft_prompt = string.format([[
Write the opening paragraph (max 120 words) of a grant application from "%s" for "%s".
Artist bio: %s | Location: %s | Genres: %s
Grant purpose: %s
Tone: professional, specific, concrete plans. Not generic.
]],
        profile.display_name or "the artist",
        grant.name,
        (profile.bio or ""):sub(1, 150),
        profile.location or "Belgium",
        table.concat(profile.genres or {}, ", "),
        grant.description:sub(1, 150)
      )
      local draft = mixhive["llm.call"](draft_prompt, "sonnet"):await()

      table.insert(suggestions, suggestion(
        "grant_opportunity",
        {
          grant_id          = grant.id,
          grant_name        = grant.name,
          org               = grant.org,
          max_amount        = grant.max_amount,
          url               = grant.url,
          eligibility_score = elig.score,
          missing           = elig.missing,
          draft_intro       = draft,
        },
        elig.score / 100,
        elig.reason,
        true
      ))
      table.insert(tasks, task(
        "Complete application: " .. grant.name .. " (max " .. tostring(grant.max_amount) .. " EUR)",
        "high"
      ))
    end

    ::continue::
  end

  if #suggestions > 0 then
    table.insert(notifications, notify(
      tostring(#suggestions) .. " grant opportunities found",
      "You may be eligible for funding. Review draft applications.",
      "email",
      "/agents/inbox"
    ))
  end

  mh_log("done — " .. #suggestions .. " grants")
  return {
    status        = #suggestions > 0 and "needs_approval" or "ok",
    suggestions   = suggestions,
    tasks         = tasks,
    notifications = notifications,
  }
end
