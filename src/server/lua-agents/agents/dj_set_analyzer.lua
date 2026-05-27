-- DJ Set Analyzer Agent (Pro tier)
-- Reads Essentia audio features + tracklist and generates set intelligence.
-- Trigger: event:mix_uploaded

function run(ctx)
  local mix_id = ctx.context and ctx.context.mix_id
  mh_log("dj_set_analyzer start mix=" .. tostring(mix_id))

  if not mix_id then return { status = "error", message = "no mix_id in context",
    suggestions = {}, tasks = {}, notifications = {} } end

  local mix = mixhive["db.read_one"]("mixes", { id = mix_id }):await()
  if not mix then return { status = "error", message = "mix not found",
    suggestions = {}, tasks = {}, notifications = {} } end

  local profile = mixhive["db.read_one"]("profiles", { id = ctx.profile_id }):await()
  if not profile then return { status = "error", message = "profile not found",
    suggestions = {}, tasks = {}, notifications = {} } end

  local features  = mixhive["audio.features"](mix_id):await()
  local tracklist = mixhive["audio.tracklist"](mix_id):await()

  if not features or features.status ~= "complete" then
    mh_log("features not ready — triggering analysis")
    mixhive["audio.trigger_analysis"](mix_id):await()
    return {
      status = "ok",
      suggestions = {},
      tasks = { task("Mix analysis queued — check back in 5 min", "low") },
      notifications = {
        notify("Mix analysis started", "We are analysing your mix. Results soon.", "in_app")
      },
    }
  end

  local analysis_prompt = string.format([[
Analyse this DJ set. Return JSON:
{"set_summary":"3 sentences","scene_classification":"label",
 "energy_arc":"description","suggested_tags":["tag"],
 "bookability_assessment":"1 sentence",
 "release_candidate":true/false,"release_reason":"1 sentence"}

BPM: %s | Key: %s | Mood: %s | Energy: %s | Danceability: %s
Duration: %s min | Tracks identified: %d | Artist: %s
]],
    tostring(features.bpm or "?"),
    features.camelot or features.musical_key or "?",
    features.mood or "?",
    tostring(features.energy or "?"),
    tostring(features.danceability or "?"),
    tostring(math.floor((mix.duration_seconds or 0) / 60)),
    #tracklist,
    profile.display_name or "unknown"
  )

  local report = mixhive["llm.json"](analysis_prompt,
    '{"set_summary":string,"scene_classification":string,"energy_arc":string,"suggested_tags":["string"],"bookability_assessment":string,"release_candidate":boolean,"release_reason":string}',
    "sonnet"
  ):await()

  if not ctx.dry_run then
    mixhive["db.update"]("mixes", { id = mix_id }, {
      tags = report.suggested_tags,
    }):await()
  end

  local suggestions = {
    suggestion(
      "mix_analysis_complete",
      {
        mix_id          = mix_id,
        report          = report,
        tracklist_count = #tracklist,
        bpm             = features.bpm,
        key             = features.camelot or features.musical_key,
        mood            = features.mood,
      },
      0.90,
      "Full AI analysis — tracklist, energy arc, scene classification",
      false
    )
  }

  if report.release_candidate then
    table.insert(suggestions, suggestion(
      "release_candidate",
      { mix_id = mix_id, reason = report.release_reason },
      0.80,
      "Release potential: " .. (report.release_reason or ""),
      false
    ))
  end

  mh_log("analysis done scene=" .. (report.scene_classification or "?"))
  return {
    status        = "ok",
    suggestions   = suggestions,
    tasks         = {},
    notifications = {
      notify(
        "Mix analysis complete",
        "Scene: " .. (report.scene_classification or "?") ..
        " | BPM: " .. tostring(features.bpm or "?") ..
        " | " .. #tracklist .. " tracks",
        "in_app",
        "/mixes/" .. mix_id
      )
    },
  }
end
