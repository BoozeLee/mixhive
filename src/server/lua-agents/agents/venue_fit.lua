-- Venue Fit Agent
-- Scores artist-venue compatibility using find_candidate_venues RPC +
-- active opportunity matching. The RPC gives us the venues table directly,
-- filtered by genre overlap and city. Opportunities are then intersected.
-- Trigger: on_demand | approval_policy: auto (pro tier)

function run(ctx)
  mh_log("venue_fit start", ctx.profile_id)

  local profile = mixhive["db.read_one"]("profiles", { id = ctx.profile_id }):await()
  if not profile then
    return { status = "error", message = "profile not found",
             suggestions = {}, tasks = {}, notifications = {} }
  end

  -- Use find_candidate_venues RPC for genre+city filtered venue candidates
  local city = (profile.location or ""):match("^([^,]+)") or nil
  local venues = mixhive["db.rpc"]("find_candidate_venues", {
    p_genres  = profile.genres or {},
    p_city    = city,
    p_country = "BE",
    p_limit   = 20,
  }):await()

  -- Also pull active booking opportunities to cross-reference
  local opps = mixhive["db.read"]("opportunities", { is_active = true }, 30):await()
  local booking_opps = {}
  for _, o in ipairs(opps) do
    local t = o.opp_type or ""
    if t == "gig" or t == "festival" or t == "residency" then
      table.insert(booking_opps, o)
    end
  end

  if #venues == 0 and #booking_opps == 0 then
    mh_log("no venues or booking opportunities found")
    return { status = "ok", suggestions = {}, tasks = {}, notifications = {} }
  end

  -- Build context lines for LLM scoring
  local venue_lines = {}
  for i, v in ipairs(venues) do
    if i > 15 then break end
    table.insert(venue_lines, string.format(
      "V%d. %s | %s | genres: %s | overlap: %d | capacity: %s",
      i, v.name or "?", v.city or "?",
      table.concat(v.genres or {}, ","),
      v.genre_overlap or 0,
      tostring(v.capacity or "?")
    ))
  end

  local opp_lines = {}
  for i, o in ipairs(booking_opps) do
    if i > 10 then break end
    table.insert(opp_lines, string.format(
      "O%d. [%s] %s | city: %s | comp: %s | deadline: %s",
      i, o.opp_type or "gig",
      o.title or "?",
      o.city or o.location or "?",
      o.compensation or "?",
      o.deadline or "open"
    ))
  end

  local score_prompt = string.format([[
You are a DJ booking consultant scoring venue/opportunity fit for an underground electronic artist.
Score based on: genre overlap (most important), city proximity, career stage, and compensation.

Artist: %s | Location: %s | Genres: %s | Style: %s

Candidate Venues (from DB):
%s

Active Opportunities:
%s

Return top 5 combined fits. JSON only:
{"top_5":[{"ref":"V1 or O2","name":"string","fit_score":0-100,"genre_match":"string","recommendation":"1 sentence"}]}
fit_score: 0-100.
]],
    profile.display_name or profile.username or "Artist",
    profile.location or "Belgium",
    table.concat(profile.genres or {}, ", "),
    profile.dj_style or "DJ",
    #venue_lines > 0 and table.concat(venue_lines, "\n") or "(none)",
    #opp_lines > 0 and table.concat(opp_lines, "\n") or "(none)"
  )

  local ranked = mixhive["llm.json"](score_prompt,
    '{"top_5":[{"ref":string,"name":string,"fit_score":number,"genre_match":string,"recommendation":string}]}',
    "haiku"
  ):await()

  local suggs = {}
  for _, hit in ipairs(ranked.top_5 or {}) do
    table.insert(suggs, suggestion(
      "venue_fit_score",
      {
        ref            = hit.ref,
        name           = hit.name,
        fit_score      = hit.fit_score,
        genre_match    = hit.genre_match,
        recommendation = hit.recommendation,
      },
      (hit.fit_score or 50) / 100,
      hit.recommendation or "Genre and location alignment detected",
      false
    ))
  end

  mh_log("venue_fit scored " .. #suggs .. " targets")

  return {
    status        = "ok",
    suggestions   = suggs,
    tasks         = {},
    notifications = #suggs > 0 and {
      notify(
        "Venue fit analysis complete",
        #suggs .. " venues/opportunities scored — top match: " .. (suggs[1] and suggs[1].payload.name or "?"),
        "in_app",
        "/agents/inbox"
      )
    } or {},
  }
end
