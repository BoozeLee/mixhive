-- Event Organizer Agent
-- Helps partners assemble 4-act lineups from available booking-open artists.
-- Trigger: on_demand | approval_policy: always (partner tier)

function run(ctx)
  mh_log("event_organizer start", ctx.profile_id)

  -- Fetch artists who have opted into booking
  local goals = mixhive["db.read"]("artist_goals", { booking_open = true }, 20):await()

  if #goals == 0 then
    mh_log("no booking-open artists found")
    return { status = "ok", suggestions = {}, tasks = {}, notifications = {} }
  end

  -- Fetch profile details for each artist
  local artist_lines = {}
  for i, g in ipairs(goals) do
    if i > 15 then break end
    local profile = mixhive["db.read_one"]("profiles", { id = g.user_id }):await()
    if profile then
      local mixes = mixhive["db.read"]("mixes", { dj_id = g.user_id, published = true }, 3):await()
      table.insert(artist_lines, string.format(
        "%d. %s | %s | genres: %s | mixes: %d | skills: %s",
        i,
        profile.display_name or profile.username or "Artist",
        profile.location or "Belgium",
        table.concat(profile.genres or {}, ", "),
        #mixes,
        table.concat(g.skills or {}, ", ")
      ))
    end
  end

  -- Read event context from opportunities if organizer has one
  local event_context = ""
  local opp = mixhive["db.read_one"]("opportunities", { opp_type = "festival" }):await()
  if opp then
    event_context = string.format("Event context: %s | %s | %s",
      opp.title or "Festival",
      opp.city or "Belgium",
      table.concat(opp.genres or {}, ", "))
  end

  local lineup_prompt = string.format([[
You are a rave booking agent for the Belgian underground electronic scene.
Assemble a 4-act lineup from the available artists. Think: narrative arc, genre flow, energy build.
Roles: headliner (peak time), main support (pre-headliner), opener, wildcard (experimental/different genre).

%s

Available artists:
%s

Return JSON only:
{
  "lineup": [
    {"role":"headliner","artist_index":N,"slot_time":"HH:MM","set_length_min":N,"rationale":"string"},
    {"role":"main_support","artist_index":N,"slot_time":"HH:MM","set_length_min":N,"rationale":"string"},
    {"role":"opener","artist_index":N,"slot_time":"HH:MM","set_length_min":N,"rationale":"string"},
    {"role":"wildcard","artist_index":N,"slot_time":"HH:MM","set_length_min":N,"rationale":"string"}
  ],
  "event_concept": "string"
}
]],
    event_context,
    table.concat(artist_lines, "\n")
  )

  local lineup = mixhive["llm.json"](lineup_prompt,
    '{"lineup":[{"role":string,"artist_index":number,"slot_time":string,"set_length_min":number,"rationale":string}],"event_concept":string}',
    "sonnet"
  ):await()

  local suggs = {}
  for _, slot in ipairs(lineup.lineup or {}) do
    local g = goals[slot.artist_index]
    table.insert(suggs, suggestion(
      "slot_suggestion",
      {
        role          = slot.role,
        artist_id     = g and g.user_id or nil,
        slot_time     = slot.slot_time,
        set_length_min = slot.set_length_min,
        rationale     = slot.rationale,
        event_concept = lineup.event_concept,
      },
      0.80,
      "Lineup assembled from booking-open artists on MixHive",
      true
    ))
  end

  mh_log("event_organizer built lineup with " .. #suggs .. " slots")

  return {
    status        = "needs_approval",
    suggestions   = suggs,
    tasks         = {
      task("Confirm artist availability for each slot", "high"),
      task("Draft event announcement copy", "medium"),
    },
    notifications = {
      notify(
        "Lineup draft ready",
        "4-act lineup assembled — concept: " .. (lineup.event_concept or "TBD"),
        "in_app",
        "/agents/inbox"
      )
    },
  }
end
