-- Venue Fit Agent
-- Scores active gig/festival/residency opportunities against the artist's profile.
-- Trigger: on_demand | approval_policy: auto (pro tier)

function run(ctx)
  mh_log("venue_fit start", ctx.profile_id)

  local profile = mixhive["db.read_one"]("profiles", { id = ctx.profile_id }):await()
  if not profile then
    return { status = "error", message = "profile not found",
             suggestions = {}, tasks = {}, notifications = {} }
  end

  local opps = mixhive["db.read"]("opportunities", { is_active = true }, 30):await()

  local booking_opps = {}
  for _, o in ipairs(opps) do
    local t = o.opp_type or ""
    if t == "gig" or t == "festival" or t == "residency" then
      table.insert(booking_opps, o)
    end
  end

  if #booking_opps == 0 then
    mh_log("no active booking opportunities to score")
    return { status = "ok", suggestions = {}, tasks = {}, notifications = {} }
  end

  local opp_lines = {}
  for i, o in ipairs(booking_opps) do
    if i > 20 then break end
    table.insert(opp_lines, string.format(
      "%d. [%s] %s | city: %s | genres: %s | compensation: %s",
      i,
      o.opp_type or "gig",
      o.title or "?",
      o.city or o.location or "?",
      table.concat(o.genres or {}, ","),
      o.compensation or "?"
    ))
  end

  local score_prompt = string.format([[
You are a DJ booking consultant scoring venue/event fit for an underground artist.
Score based on: genre alignment, location proximity, artist career stage, compensation fairness.

Artist: %s | Location: %s | Genres: %s | Style: %s

Opportunities:
%s

Return the top 5 by fit. JSON only:
{"top_5":[{"index":N,"fit_score":N,"genre_match":"string","location_notes":"string"}]}
fit_score is 0-100.
]],
    profile.display_name or profile.username or "Artist",
    profile.location or "Belgium",
    table.concat(profile.genres or {}, ", "),
    profile.dj_style or "DJ",
    table.concat(opp_lines, "\n")
  )

  local ranked = mixhive["llm.json"](score_prompt,
    '{"top_5":[{"index":number,"fit_score":number,"genre_match":string,"location_notes":string}]}',
    "haiku"
  ):await()

  local suggs = {}
  for _, hit in ipairs(ranked.top_5 or {}) do
    local opp = booking_opps[hit.index]
    if opp then
      table.insert(suggs, suggestion(
        "venue_fit_score",
        {
          opportunity_id  = opp.id,
          title           = opp.title,
          opp_type        = opp.opp_type,
          city            = opp.city or opp.location,
          fit_score       = hit.fit_score,
          genre_match     = hit.genre_match,
          location_notes  = hit.location_notes,
          compensation    = opp.compensation,
          deadline        = opp.deadline,
        },
        (hit.fit_score or 50) / 100,
        "Scored by genre alignment, location, and compensation",
        false
      ))
    end
  end

  mh_log("venue_fit scored " .. #suggs .. " opportunities")

  return {
    status        = "ok",
    suggestions   = suggs,
    tasks         = {},
    notifications = #suggs > 0 and {
      notify(
        "Venue fit scores ready",
        "Top match: " .. (booking_opps[1] and booking_opps[1].title or "?") .. " — check your inbox.",
        "in_app",
        "/agents/inbox"
      )
    } or {},
  }
end
