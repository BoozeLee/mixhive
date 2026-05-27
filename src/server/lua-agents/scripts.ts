// Lua agent scripts embedded at build time.
// Each script is a string constant containing the Lua source.
// Edit the corresponding *.lua file in agents/ and re-paste here to update.

export const PROFILE_COACH = `
-- Profile Coach Agent
-- Scores a DJ/producer profile on 5 axes and surfaces targeted improvements.

function run(ctx)
  mh_log("profile_coach start", ctx.profile_id)

  local profile = mixhive["db.read_one"]("profiles", { id = ctx.profile_id }):await()
  if not profile then
    return { status = "error", message = "profile not found",
             suggestions = {}, tasks = {}, notifications = {} }
  end

  local mixes = mixhive["db.read"]("mixes", { dj_id = ctx.profile_id, published = true }, 5):await()

  local score_prompt = string.format([[
Score this DJ/producer profile for bookability. Return JSON only:
{ "bio": N, "visuals": N, "mix_quality": N, "social_proof": N, "overall": N, "weakest": "axis" }
Each axis 0-100. Blank bio=0, no avatar=10, no mixes=20.

Name: %s
Bio (%d chars): %s
Avatar: %s
Mixes uploaded: %d
Location: %s
Genres: %s
]],
    profile.display_name or "unnamed",
    #(profile.bio or ""),
    (profile.bio or ""):sub(1, 400),
    profile.avatar_url and "set" or "missing",
    #mixes,
    profile.location or "not set",
    table.concat(profile.genres or {}, ", ")
  )

  local score = mixhive["llm.json"](score_prompt,
    '{"bio":number,"visuals":number,"mix_quality":number,"social_proof":number,"overall":number,"weakest":string}',
    "haiku"
  ):await()

  mh_log("score overall=" .. tostring(score.overall))

  local suggestions = {}
  local tasks = {}
  local notifications = {}

  if (score.bio or 0) < 60 then
    local bio_prompt = string.format([[
Write a punchy 3-sentence artist bio for this underground DJ/producer.
Name: %s | Location: %s | Genres: %s | Existing bio: %s
Style: honest, underground, first-person. Max 100 words.
]],
      profile.display_name or "this artist",
      profile.location or "Belgium",
      table.concat(profile.genres or {}, ", "),
      profile.bio or "(none)"
    )
    local new_bio = mixhive["llm.call"](bio_prompt, "sonnet"):await()
    table.insert(suggestions, suggestion(
      "bio_rewrite",
      { current = profile.bio, proposed = new_bio },
      0.85,
      "Bio score " .. tostring(score.bio) .. "/100 — too short or generic",
      true
    ))
    table.insert(tasks, task("Review and update your bio", "high"))
  end

  if not profile.avatar_url then
    table.insert(suggestions, suggestion(
      "missing_avatar", { action = "upload_avatar" }, 1.0,
      "No avatar — promoters skip profiles without a visual identity", false
    ))
    table.insert(tasks, task("Upload a profile photo", "high"))
  end

  if #mixes == 0 then
    table.insert(suggestions, suggestion(
      "no_mixes", { action = "upload_mix" }, 1.0,
      "No published mixes — zero audio evidence of your sound", false
    ))
    table.insert(tasks, task("Upload your first mix", "high"))
  end

  local links = profile.social_links or {}
  if not links.soundcloud and not links.mixcloud and not links.ra then
    table.insert(suggestions, suggestion(
      "missing_social_links",
      { action = "add_links", platforms = {"soundcloud", "ra", "mixcloud"} },
      0.8, "No streaming profile linked — promoters cannot verify your presence", false
    ))
  end

  if (score.overall or 0) < 70 then
    table.insert(notifications, notify(
      "Profile score: " .. tostring(score.overall) .. "/100",
      "Weakest area: " .. (score.weakest or "?") .. ". Improve it to get more bookings.",
      "in_app", "/profile/edit"
    ))
  end

  mh_log("done — " .. #suggestions .. " suggestions")
  return {
    status = #suggestions > 0 and "needs_approval" or "ok",
    suggestions = suggestions, tasks = tasks, notifications = notifications,
  }
end
`

export const GRANT_ASSISTANT = `
-- Grant Assistant Agent
-- Scores eligibility for Belgian and EU music grants, drafts application intros.

local GRANTS = {
  { id = "sabam_culture", name = "Sabam for Culture", org = "Sabam", country = "BE",
    max_amount = 5000,
    description = "Supports Belgian creators for cultural projects. Members only.",
    eligibility = "Must be Sabam member. Belgian nationality or residence.",
    url = "https://www.sabam.be" },
  { id = "playright_plus", name = "PlayRight+ Music Video Grant", org = "PlayRight", country = "BE",
    max_amount = 750,
    description = "Half of production costs (max 750 EUR) for a music video or live session.",
    eligibility = "Must be a PlayRight beneficiary.",
    url = "https://playright.be" },
  { id = "fund_belgian_music", name = "Fund Belgian Music", org = "FACIR/Sabam/PlayRight+", country = "BE",
    max_amount = 7500,
    description = "Max 30% of budget, capped at 7500 EUR. Belgian music cultural impact.",
    eligibility = "Belgian professional musician or collective.",
    url = "https://kbs-frb.be" },
  { id = "effea", name = "EFFEA — European Festivals Fund for Emerging Artists", org = "EFFEA", country = "EU",
    max_amount = 15000,
    description = "Supports emerging artists at European festivals.",
    eligibility = "Emerging artist (not yet headline). European nationality or residence.",
    url = "https://www.effa.info" },
}

function run(ctx)
  mh_log("grant_assistant start", ctx.profile_id)

  local profile = mixhive["db.read_one"]("profiles", { id = ctx.profile_id }):await()
  if not profile then return { status = "error", message = "profile not found",
    suggestions = {}, tasks = {}, notifications = {} } end

  local suggestions = {}
  local tasks = {}
  local notifications = {}

  for _, grant in ipairs(GRANTS) do
    if grant.country ~= "EU" and grant.country ~= "BE" then goto continue end

    local score_prompt = string.format([[
Score artist eligibility for this grant. Return JSON:
{"score":0-100,"eligible":true/false,"reason":"1 sentence","missing":["item"]}
Artist: %s | Location: %s | Genres: %s | Bio: %s
Grant: %s | Criteria: %s
]],
      profile.display_name or "Artist",
      profile.location or "unknown",
      table.concat(profile.genres or {}, ", "),
      (profile.bio or ""):sub(1, 150),
      grant.name, grant.eligibility
    )

    local elig = mixhive["llm.json"](score_prompt,
      '{"score":number,"eligible":boolean,"reason":string,"missing":["string"]}',
      "haiku"
    ):await()

    mh_log(grant.name .. " score=" .. tostring(elig.score))

    if (elig.score or 0) >= 55 then
      local draft_prompt = string.format([[
Write opening paragraph (max 100 words) of grant application from "%s" for "%s".
Artist: %s | Location: %s | Genres: %s
Grant purpose: %s
Tone: professional, specific.
]],
        profile.display_name or "the artist", grant.name,
        (profile.bio or ""):sub(1, 120), profile.location or "Belgium",
        table.concat(profile.genres or {}, ", "), grant.description:sub(1, 120)
      )
      local draft = mixhive["llm.call"](draft_prompt, "sonnet"):await()

      table.insert(suggestions, suggestion(
        "grant_opportunity",
        { grant_id = grant.id, grant_name = grant.name, org = grant.org,
          max_amount = grant.max_amount, url = grant.url,
          eligibility_score = elig.score, missing = elig.missing, draft_intro = draft },
        elig.score / 100, elig.reason, true
      ))
      table.insert(tasks, task(
        "Complete application: " .. grant.name .. " (max " .. tostring(grant.max_amount) .. " EUR)", "high"
      ))
    end
    ::continue::
  end

  if #suggestions > 0 then
    table.insert(notifications, notify(
      tostring(#suggestions) .. " grant opportunities found",
      "You may be eligible for funding. Review draft applications.",
      "email", "/agents/inbox"
    ))
  end

  mh_log("done — " .. #suggestions .. " grants")
  return {
    status = #suggestions > 0 and "needs_approval" or "ok",
    suggestions = suggestions, tasks = tasks, notifications = notifications,
  }
end
`

export const OPPORTUNITY_MATCH = `
-- Opportunity Match Agent
-- Matches artist to open opportunities from the opportunities table.

function run(ctx)
  mh_log("opportunity_match start", ctx.profile_id)

  local profile = mixhive["db.read_one"]("profiles", { id = ctx.profile_id }):await()
  if not profile then return { status = "error", message = "profile not found",
    suggestions = {}, tasks = {}, notifications = {} } end

  local opps = mixhive["db.read"]("opportunities", { is_active = true }, 20):await()
  if #opps == 0 then
    return { status = "ok", suggestions = {}, tasks = {}, notifications = {} }
  end

  local suggestions = {}

  for _, opp in ipairs(opps) do
    if #suggestions >= 8 then break end

    local rationale_prompt = string.format([[
In 1 sentence (max 20 words), explain why "%s" (genres: %s, location: %s) fits:
"%s" — %s
]],
      profile.display_name or "this artist",
      table.concat(profile.genres or {}, ", "),
      profile.location or "Belgium",
      opp.title or "opportunity",
      (opp.description or ""):sub(1, 120)
    )

    local rationale = mixhive["llm.call"](rationale_prompt, "haiku"):await()

    table.insert(suggestions, suggestion(
      "opportunity_match",
      { opportunity_id = opp.id, title = opp.title, opp_type = opp.opp_type,
        city = opp.city, compensation = opp.compensation,
        deadline = opp.deadline, source_url = opp.source_url },
      0.70, rationale, false
    ))
  end

  local notifications = {}
  if #suggestions > 0 then
    table.insert(notifications, notify(
      #suggestions .. " opportunities matched",
      "New gigs, grants, and open calls matched to your profile.",
      "in_app", "/agents/inbox"
    ))
  end

  mh_log("done — " .. #suggestions .. " matches")
  return { status = "ok", suggestions = suggestions, tasks = {}, notifications = notifications }
end
`

export const MODERATION = `
-- Moderation Agent — underground-culture-aware content screening.

function run(ctx)
  local content_id   = ctx.context and ctx.context.content_id
  local content_type = ctx.context and ctx.context.content_type or "post"
  mh_log("moderation start", content_type, content_id)

  if not content_id then return { status = "error", message = "no content_id",
    suggestions = {}, tasks = {}, notifications = {} } end

  local content = mixhive["db.read_one"](content_type .. "s", { id = content_id }):await()
  if not content then return { status = "error", message = "content not found",
    suggestions = {}, tasks = {}, notifications = {} } end

  local text = content.body or content.description or content.bio or ""

  local mod_prompt = string.format([[
Moderate content for an underground electronic music platform. Return JSON only:
{"action":"allow"|"warn"|"hide"|"escalate","severity":0-10,
 "flags":["hate_speech"|"spam"|"fraud"|"doxxing"|"harassment"|"none"],
 "reason":"1 sentence"}

Context: drug references in harm-reduction context, profanity, rave culture language are NORMAL.
Flag only: hate based on protected characteristics, fraud, doxxing, CSAM, violent threats.

Content type: %s | Text: %s
]],
    content_type, text:sub(1, 700)
  )

  local result = mixhive["llm.json"](mod_prompt,
    '{"action":string,"severity":number,"flags":["string"],"reason":string}',
    "haiku"
  ):await()

  mh_log("action=" .. (result.action or "?") .. " severity=" .. tostring(result.severity))

  if not ctx.dry_run then
    mixhive["db.insert"]("moderation_signals", {
      source_table = content_type .. "s",
      source_id    = content_id,
      signal_type  = table.concat(result.flags or {}, ","),
      severity     = result.severity or 0,
      action_taken = result.action or "allow",
    }):await()

    if result.action == "hide" or result.action == "escalate" then
      mixhive["db.update"](content_type .. "s", { id = content_id }, {
        moderation_status = result.action,
        moderation_reason = result.reason,
      }):await()
    end
  end

  local suggestions = {}
  if result.action == "escalate" then
    table.insert(suggestions, suggestion(
      "moderation_escalation",
      { content_id = content_id, content_type = content_type, result = result },
      1.0, result.reason, true
    ))
  end

  return {
    status = result.action == "escalate" and "needs_approval" or "ok",
    suggestions = suggestions, tasks = {}, notifications = {},
  }
end
`

export const PRESS_KIT = `
-- Press Kit Agent — generates a complete EPK draft.

function run(ctx)
  mh_log("press_kit start", ctx.profile_id)

  local profile = mixhive["db.read_one"]("profiles", { id = ctx.profile_id }):await()
  if not profile then return { status = "error", message = "profile not found",
    suggestions = {}, tasks = {}, notifications = {} } end

  local mixes = mixhive["db.read"]("mixes", { dj_id = ctx.profile_id, published = true }, 3):await()

  local epk_prompt = string.format([[
Write a professional Electronic Press Kit for an underground DJ/producer. Return JSON only, no backticks.
{"headline":"punchy 1 sentence","bio_short":"max 80 words","bio_long":"max 200 words",
 "genre_tags":["tag"],"technical_rider_stub":"4 lines","booking_email_template":"short email with subject",
 "press_quote":"[PLACEHOLDER — replace with real quote]"}
Artist: %s | Location: %s | Genres: %s | Bio: %s | Mixes: %d
]],
    profile.display_name or "Artist",
    profile.location or "Belgium",
    table.concat(profile.genres or {}, ", "),
    (profile.bio or ""):sub(1, 300),
    #mixes
  )

  local epk = mixhive["llm.json"](epk_prompt,
    '{"headline":string,"bio_short":string,"bio_long":string,"genre_tags":["string"],"technical_rider_stub":string,"booking_email_template":string,"press_quote":string}',
    "sonnet"
  ):await()

  epk.social_links = profile.social_links or {}

  if not ctx.dry_run then
    mixhive["db.upsert"]("press_kits", {
      profile_id = ctx.profile_id, version = 1,
      content_json = epk, public_slug = ctx.profile_id,
    }):await()
  end

  mh_log("EPK generated")
  return {
    status = "needs_approval",
    suggestions = {
      suggestion("press_kit_generated",
        { epk = epk, public_url = "/epk/" .. ctx.profile_id },
        0.95, "EPK generated — review before sharing", true)
    },
    tasks = { task("Review and publish your Press Kit", "high") },
    notifications = {
      notify("Your Press Kit is ready", "Review and share with promoters.", "in_app", "/dashboard/press-kit")
    },
  }
end
`

export const DJ_SET_ANALYZER = `
-- DJ Set Analyzer Agent (Pro tier)

function run(ctx)
  local mix_id = ctx.context and ctx.context.mix_id
  mh_log("dj_set_analyzer start mix=" .. tostring(mix_id))

  if not mix_id then return { status = "error", message = "no mix_id",
    suggestions = {}, tasks = {}, notifications = {} } end

  local mix      = mixhive["db.read_one"]("mixes",    { id = mix_id }):await()
  local profile  = mixhive["db.read_one"]("profiles", { id = ctx.profile_id }):await()
  if not mix or not profile then return { status = "error", message = "record not found",
    suggestions = {}, tasks = {}, notifications = {} } end

  local features  = mixhive["audio.features"](mix_id):await()
  local tracklist = mixhive["audio.tracklist"](mix_id):await()

  if not features or features.status ~= "complete" then
    mh_log("features not ready — triggering analysis")
    mixhive["audio.trigger_analysis"](mix_id):await()
    return {
      status = "ok", suggestions = {},
      tasks = { task("Mix analysis queued — check back in 5 min", "low") },
      notifications = { notify("Mix analysis started", "Results in ~5 min.", "in_app") },
    }
  end

  local analysis_prompt = string.format([[
Analyse this DJ set. Return JSON:
{"set_summary":"3 sentences","scene_classification":"label","energy_arc":"description",
 "suggested_tags":["tag"],"bookability_assessment":"1 sentence",
 "release_candidate":true/false,"release_reason":"1 sentence"}
BPM: %s | Key: %s | Mood: %s | Energy: %s | Duration: %s min | Tracks: %d | Artist: %s
]],
    tostring(features.bpm or "?"),
    features.camelot or features.musical_key or "?",
    features.mood or "?",
    tostring(features.energy or "?"),
    tostring(math.floor((mix.duration_seconds or 0) / 60)),
    #tracklist,
    profile.display_name or "unknown"
  )

  local report = mixhive["llm.json"](analysis_prompt,
    '{"set_summary":string,"scene_classification":string,"energy_arc":string,"suggested_tags":["string"],"bookability_assessment":string,"release_candidate":boolean,"release_reason":string}',
    "sonnet"
  ):await()

  if not ctx.dry_run then
    mixhive["db.update"]("mixes", { id = mix_id }, { tags = report.suggested_tags }):await()
  end

  local suggestions = {
    suggestion("mix_analysis_complete",
      { mix_id = mix_id, report = report, tracklist_count = #tracklist,
        bpm = features.bpm, key = features.camelot or features.musical_key, mood = features.mood },
      0.90, "Full AI analysis — tracklist, energy arc, scene classification", false)
  }
  if report.release_candidate then
    table.insert(suggestions, suggestion("release_candidate",
      { mix_id = mix_id, reason = report.release_reason },
      0.80, "Release potential: " .. (report.release_reason or ""), false))
  end

  mh_log("done scene=" .. (report.scene_classification or "?"))
  return {
    status = "ok", suggestions = suggestions, tasks = {},
    notifications = {
      notify("Mix analysis complete",
        "Scene: " .. (report.scene_classification or "?") ..
        " | BPM: " .. tostring(features.bpm or "?") ..
        " | " .. #tracklist .. " tracks",
        "in_app", "/mixes/" .. mix_id)
    },
  }
end
`

export const SCENE_RADAR = `
-- Scene Radar Agent — weekly underground scene digest.

function run(ctx)
  mh_log("scene_radar start", ctx.profile_id)

  local recent_mixes = mixhive["db.read"]("mixes", { published = true }, 50):await()

  local genre_counts = {}
  for _, m in ipairs(recent_mixes) do
    for _, tag in ipairs(m.tags or {}) do
      genre_counts[tag] = (genre_counts[tag] or 0) + 1
    end
  end

  local trend_lines = {}
  for genre, count in pairs(genre_counts) do
    table.insert(trend_lines, genre .. ": " .. count)
  end
  table.sort(trend_lines, function(a, b) return a > b end)

  if #trend_lines == 0 then
    return { status = "ok", suggestions = {}, tasks = {}, notifications = {} }
  end

  local digest_prompt = string.format([[
Write a 2-paragraph underground music scene digest based on these genre signals.
Insider tone, casual, no hype. Include what is rising, one actionable tip for a DJ. Max 150 words.
Signals:
%s
]],
    table.concat(trend_lines, "\\n"):sub(1, 500)
  )

  local digest = mixhive["llm.call"](digest_prompt, "sonnet"):await()

  mh_log("digest generated")
  return {
    status = "ok",
    suggestions = {
      suggestion("scene_digest", { digest = digest }, 0.75,
        "Weekly platform-wide underground scene intelligence", false)
    },
    tasks = {},
    notifications = { notify("Scene update", digest:sub(1, 100) .. "...", "in_app", "/dashboard") },
  }
end
`

export const NOTIFICATION_PRIORITIZER = `
-- Notification Prioritizer Agent — surfaces top 3 unread notifications.

function run(ctx)
  mh_log("notification_prioritizer start", ctx.profile_id)

  local pending = mixhive["db.read"]("notifications", {
    profile_id = ctx.profile_id, read = false,
  }, 50):await()

  if #pending == 0 then
    return { status = "ok", suggestions = {}, tasks = {}, notifications = {} }
  end

  mh_log("pending=" .. #pending)

  local lines = {}
  for i, n in ipairs(pending) do
    table.insert(lines, string.format("%d. [%s] %s", i, n.type or "?", (n.message or ""):sub(1, 60)))
  end

  local rank_prompt = string.format([[
Rank these %d notifications for a DJ/producer. Select top 3 by urgency.
Prioritise: deadlines, booking/grant opportunities, direct messages.
De-prioritise: generic likes/follows.
Return JSON: {"top_3_indices":[1,5,12],"digest":"1 sentence summary"}
Notifications:
%s
]],
    #pending, table.concat(lines, "\\n"):sub(1, 1200)
  )

  local ranked = mixhive["llm.json"](rank_prompt,
    '{"top_3_indices":[number],"digest":string}', "haiku"
  ):await()

  local daily_notifs = {}
  for _, idx in ipairs(ranked.top_3_indices or {1}) do
    local n = pending[idx]
    if n then
      table.insert(daily_notifs, notify(n.title or "Update", n.message or "", "in_app", n.action_url))
    end
  end

  if ranked.digest then
    table.insert(daily_notifs, notify("Today's digest", ranked.digest, "in_app", "/dashboard"))
  end

  mh_log("surfaced " .. #daily_notifs)
  return { status = "ok", suggestions = {}, tasks = {}, notifications = daily_notifs }
end
`

export const STUB = `
-- Stub agent — returns ok with no suggestions.
function run(ctx)
  mh_log("stub agent run", ctx.agent_id)
  return { status = "ok", suggestions = {}, tasks = {}, notifications = {} }
end
`
