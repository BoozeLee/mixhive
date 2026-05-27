-- Booking Scout Agent
-- Finds gig/festival/residency opportunities that fit the artist's profile.
-- Uses vector search for peer-signal context, then LLM fit scoring.
-- Trigger: on_demand | approval_policy: on_action

function run(ctx)
  mh_log("booking_scout start", ctx.profile_id)

  local profile = mixhive["db.read_one"]("profiles", { id = ctx.profile_id }):await()
  if not profile then
    return { status = "error", message = "profile not found",
             suggestions = {}, tasks = {}, notifications = {} }
  end

  local mixes = mixhive["db.read"]("mixes", { dj_id = ctx.profile_id, published = true }, 5):await()

  -- Vector search for similar artists as peer signal
  local bio_text = string.format("%s %s %s",
    profile.bio or "",
    table.concat(profile.genres or {}, " "),
    profile.dj_style or ""
  )
  local similar = mixhive["vector.search"](bio_text, "profile", 5):await()
  local peer_genres = {}
  for _, s in ipairs(similar) do
    if s.metadata and s.metadata.genres then
      for _, g in ipairs(s.metadata.genres) do
        peer_genres[g] = true
      end
    end
  end

  -- Fetch active booking opportunities
  local opps = mixhive["db.read"]("opportunities", { is_active = true }, 30):await()
  local booking_opps = {}
  for _, o in ipairs(opps) do
    local t = o.opp_type or ""
    if t == "gig" or t == "festival" or t == "residency" then
      table.insert(booking_opps, o)
    end
  end

  if #booking_opps == 0 then
    mh_log("no booking opportunities found")
    return { status = "ok", suggestions = {}, tasks = {}, notifications = {} }
  end

  local opp_lines = {}
  for i, o in ipairs(booking_opps) do
    if i > 15 then break end
    table.insert(opp_lines, string.format(
      "%d. [%s] %s | %s | genres: %s | deadline: %s | comp: %s",
      i,
      o.opp_type or "gig",
      o.title or "?",
      o.city or o.location or "?",
      table.concat(o.genres or {}, ","),
      o.deadline or "open",
      o.compensation or "?"
    ))
  end

  local fit_prompt = string.format([[
You are a booking agent for underground electronic music.
Score which of these opportunities best fit this artist. Return top 5 only.

Artist: %s | Location: %s | Genres: %s | Style: %s
Recent mixes: %d uploaded

Opportunities:
%s

Return JSON only:
{"top_5":[{"index":N,"fit_score":N,"outreach_hook":"string","reason":"string"}]}
fit_score is 0-100. outreach_hook is 1 sentence the artist can use to open the conversation.
]],
    profile.display_name or profile.username or "Artist",
    profile.location or "Belgium",
    table.concat(profile.genres or {}, ", "),
    profile.dj_style or "DJ",
    #mixes,
    table.concat(opp_lines, "\n")
  )

  local ranked = mixhive["llm.json"](fit_prompt,
    '{"top_5":[{"index":number,"fit_score":number,"outreach_hook":string,"reason":string}]}',
    "haiku"
  ):await()

  local suggs = {}
  local tsks  = {}
  for _, hit in ipairs(ranked.top_5 or {}) do
    local opp = booking_opps[hit.index]
    if opp then
      table.insert(suggs, suggestion(
        "booking_lead",
        {
          opportunity_id  = opp.id,
          title           = opp.title,
          opp_type        = opp.opp_type,
          city            = opp.city or opp.location,
          deadline        = opp.deadline,
          compensation    = opp.compensation,
          fit_score       = hit.fit_score,
          outreach_hook   = hit.outreach_hook,
          reason          = hit.reason,
        },
        (hit.fit_score or 50) / 100,
        hit.reason or "Opportunity matches your profile",
        true
      ))
      table.insert(tsks, task("Contact: " .. (opp.title or "venue"), "high"))
    end
  end

  mh_log("booking_scout found " .. #suggs .. " leads")

  return {
    status        = #suggs > 0 and "needs_approval" or "ok",
    suggestions   = suggs,
    tasks         = tsks,
    notifications = #suggs > 0 and {
      notify(
        "Booking leads ready",
        #suggs .. " opportunities matched your profile — review and approve outreach.",
        "in_app",
        "/agents/inbox"
      )
    } or {},
  }
end
