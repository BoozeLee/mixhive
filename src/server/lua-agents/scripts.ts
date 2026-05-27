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

export const RELEASE_STRATEGY = `
-- Release Strategy Agent
-- Plans release timing and campaign steps from recent mix cadence + open opportunities.
-- Trigger: on_demand | approval_policy: always

function run(ctx)
  mh_log("release_strategy start", ctx.profile_id)

  local profile = mixhive["db.read_one"]("profiles", { id = ctx.profile_id }):await()
  if not profile then
    return { status = "error", message = "profile not found",
             suggestions = {}, tasks = {}, notifications = {} }
  end

  local mixes = mixhive["db.read"]("mixes", { dj_id = ctx.profile_id }, 5):await()

  local opps = mixhive["db.read"]("opportunities", { is_active = true }, 20):await()
  local opp_lines = {}
  for _, o in ipairs(opps) do
    local t = o.opp_type or ""
    if t == "festival" or t == "radio" or t == "contest" then
      table.insert(opp_lines, string.format("- %s (%s) deadline: %s",
        o.title or "?", t, o.deadline or "open"))
    end
  end

  local mix_lines = {}
  for _, m in ipairs(mixes) do
    table.insert(mix_lines, string.format("- %s | plays: %d | tags: %s",
      m.title or "untitled",
      m.play_count or 0,
      table.concat(m.tags or {}, ", ")))
  end

  local plan_prompt = string.format([[
You are a music release strategist for underground electronic music.
Plan a release campaign for this DJ/producer.

Profile: %s | Location: %s | Genres: %s

Recent mixes:
%s

Relevant open opportunities:
%s

Return JSON only:
{
  "release_week": "YYYY-WW or 'immediate'",
  "platforms": ["string"],
  "promo_steps": ["string", "string", "string"],
  "headline_hook": "one sentence pitch",
  "optimal_day": "Monday-Sunday"
}
]],
    profile.display_name or profile.username or "Artist",
    profile.location or "Belgium",
    table.concat(profile.genres or {}, ", "),
    #mix_lines > 0 and table.concat(mix_lines, "\\n") or "No mixes yet",
    #opp_lines > 0 and table.concat(opp_lines, "\\n") or "No open opportunities found"
  )

  local plan = mixhive["llm.json"](plan_prompt,
    '{"release_week":string,"platforms":[string],"promo_steps":[string],"headline_hook":string,"optimal_day":string}',
    "haiku"
  ):await()

  mh_log("release plan generated")

  local suggs = {
    suggestion(
      "release_plan",
      plan,
      0.80,
      "Release timing and campaign steps derived from your mix cadence and open call deadlines",
      true
    )
  }

  local tsks = {
    task("Submit mix to platforms: " .. table.concat(plan.platforms or {"Soundcloud","Bandcamp"}, ", "), "high"),
    task("Draft promo post: " .. (plan.headline_hook or "release announcement"), "medium"),
  }

  return {
    status        = "needs_approval",
    suggestions   = suggs,
    tasks         = tsks,
    notifications = {
      notify(
        "Release strategy ready",
        "Your release plan is ready for review - optimal week: " .. (plan.release_week or "TBD"),
        "in_app",
        "/agents/inbox"
      )
    },
  }
end
`

export const BOOKING_SCOUT = `
-- Booking Scout Agent
-- Finds gig/festival/residency opportunities that fit the artist's profile.
-- Trigger: on_demand | approval_policy: on_action

function run(ctx)
  mh_log("booking_scout start", ctx.profile_id)

  local profile = mixhive["db.read_one"]("profiles", { id = ctx.profile_id }):await()
  if not profile then
    return { status = "error", message = "profile not found",
             suggestions = {}, tasks = {}, notifications = {} }
  end

  local mixes = mixhive["db.read"]("mixes", { dj_id = ctx.profile_id, published = true }, 5):await()

  local bio_text = string.format("%s %s %s",
    profile.bio or "",
    table.concat(profile.genres or {}, " "),
    profile.dj_style or ""
  )
  local similar = mixhive["vector.search"](bio_text, "profile", 5):await()

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
      i, o.opp_type or "gig", o.title or "?",
      o.city or o.location or "?",
      table.concat(o.genres or {}, ","),
      o.deadline or "open", o.compensation or "?"
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
    table.concat(opp_lines, "\\n")
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
        { opportunity_id = opp.id, title = opp.title, opp_type = opp.opp_type,
          city = opp.city or opp.location, deadline = opp.deadline,
          compensation = opp.compensation, fit_score = hit.fit_score,
          outreach_hook = hit.outreach_hook, reason = hit.reason },
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
      notify("Booking leads ready",
        #suggs .. " opportunities matched your profile - review and approve outreach.",
        "in_app", "/agents/inbox")
    } or {},
  }
end
`

export const COLLABORATION_MATCH = `
-- Collaboration Match Agent
-- Finds complementary artists via vector similarity and drafts intro messages.
-- Trigger: on_demand | approval_policy: on_action

function run(ctx)
  mh_log("collaboration_match start", ctx.profile_id)

  local profile = mixhive["db.read_one"]("profiles", { id = ctx.profile_id }):await()
  if not profile then
    return { status = "error", message = "profile not found",
             suggestions = {}, tasks = {}, notifications = {} }
  end

  local bio_text = string.format("%s %s %s %s",
    profile.bio or "",
    table.concat(profile.genres or {}, " "),
    profile.dj_style or "",
    profile.location or ""
  )

  local similar = mixhive["vector.search"](bio_text, "profile", 10):await()

  local candidates = {}
  for _, s in ipairs(similar) do
    if s.entity_id ~= ctx.profile_id and #candidates < 5 then
      table.insert(candidates, s)
    end
  end

  if #candidates == 0 then
    mh_log("no similar profiles found via vector search")
    return { status = "ok", suggestions = {}, tasks = {}, notifications = {} }
  end

  local candidate_lines = {}
  for i, c in ipairs(candidates) do
    if i > 3 then break end
    local meta = c.metadata or {}
    table.insert(candidate_lines, string.format(
      "%d. %s | genres: %s | location: %s | similarity: %.2f",
      i,
      meta.display_name or meta.username or "Artist " .. i,
      table.concat(meta.genres or {}, ", "),
      meta.location or "?",
      c.similarity or 0
    ))
  end

  local intro_prompt = string.format([[
You are a music community connector for underground electronic music.
Draft a warm, direct intro message from one artist to another.
No hype, authentic underground tone. Max 80 words each.

Sender: %s | %s | %s
Genres: %s

Candidates:
%s

Return JSON only:
{"intros":[{"index":N,"to_name":"string","message":"string"}]}
]],
    profile.display_name or profile.username or "Artist",
    profile.location or "Belgium",
    profile.dj_style or "DJ",
    table.concat(profile.genres or {}, ", "),
    table.concat(candidate_lines, "\\n")
  )

  local result = mixhive["llm.json"](intro_prompt,
    '{"intros":[{"index":number,"to_name":string,"message":string}]}',
    "haiku"
  ):await()

  local suggs = {}
  for _, intro in ipairs(result.intros or {}) do
    local cand = candidates[intro.index]
    table.insert(suggs, suggestion(
      "collab_intro",
      { to_profile_id = cand and cand.entity_id or nil,
        to_name = intro.to_name, draft_message = intro.message,
        similarity = cand and cand.similarity or 0 },
      0.70,
      "Complementary style and genre overlap detected via profile embedding",
      true
    ))
  end

  mh_log("collaboration_match found " .. #suggs .. " matches")
  return {
    status        = #suggs > 0 and "needs_approval" or "ok",
    suggestions   = suggs,
    tasks         = {},
    notifications = #suggs > 0 and {
      notify("Collab matches found",
        #suggs .. " artists are a strong fit - review draft intros in your inbox.",
        "in_app", "/agents/inbox")
    } or {},
  }
end
`

export const FAN_INSIGHTS = `
-- Fan Insights Agent
-- Clusters audience from likes, play history, and analytics events.
-- Trigger: cron:weekly | approval_policy: auto (pro tier)

function run(ctx)
  mh_log("fan_insights start", ctx.profile_id)

  local mixes = mixhive["db.read"]("mixes", { dj_id = ctx.profile_id, published = true }, 20):await()

  if #mixes == 0 then
    mh_log("no published mixes found")
    return { status = "ok", suggestions = {}, tasks = {}, notifications = {} }
  end

  local total_likes = 0
  local mix_engagement = {}
  for _, m in ipairs(mixes) do
    local lc = m.likes_count or 0
    local pc = m.play_count  or 0
    total_likes = total_likes + lc
    if lc + pc > 0 then
      table.insert(mix_engagement, string.format(
        "- %s: %d plays, %d likes, tags: %s",
        m.title or "untitled", pc, lc,
        table.concat(m.tags or {}, ", ")
      ))
    end
  end

  local events = mixhive["db.read"]("analytics_events", { profile_id = ctx.profile_id }, 50):await()
  local event_counts = {}
  for _, e in ipairs(events) do
    local t = e.event_type or "unknown"
    event_counts[t] = (event_counts[t] or 0) + 1
  end
  local event_summary = {}
  for t, c in pairs(event_counts) do
    table.insert(event_summary, t .. ": " .. c)
  end

  local followers = mixhive["db.read"]("follows", { following_id = ctx.profile_id }, 50):await()

  local cluster_prompt = string.format([[
You are an audience analytics specialist for underground electronic music.
Cluster this DJ's audience into 3 distinct segments based on engagement signals.

Artist: %s | Total mixes: %d | Total likes: %d | Followers: %d

Mix engagement (top %d):
%s

Platform events:
%s

Return JSON only:
{
  "segments": [
    {"label":"string","size_pct":N,"behaviour":"string","action_tip":"string"}
  ],
  "top_performing_tag": "string",
  "growth_insight": "string"
}
]],
    ctx.profile_id, #mixes, total_likes, #followers,
    math.min(#mix_engagement, 10),
    table.concat(mix_engagement, "\\n"):sub(1, 800),
    table.concat(event_summary, ", "):sub(1, 200)
  )

  local clusters = mixhive["llm.json"](cluster_prompt,
    '{"segments":[{"label":string,"size_pct":number,"behaviour":string,"action_tip":string}],"top_performing_tag":string,"growth_insight":string}',
    "sonnet"
  ):await()

  mh_log("fan_insights clusters generated")
  return {
    status = "ok",
    suggestions = {
      suggestion("fan_cluster_report", clusters, 0.80,
        "Audience segmentation from " .. #mixes .. " mixes and " .. #followers .. " followers",
        false)
    },
    tasks = {},
    notifications = {
      notify("Fan insights ready",
        "Your audience report is ready - top tag: " .. (clusters.top_performing_tag or "?"),
        "in_app", "/agents/inbox")
    },
  }
end
`

export const EVENT_ORGANIZER = `
-- Event Organizer Agent
-- Helps partners assemble 4-act lineups from available booking-open artists.
-- Trigger: on_demand | approval_policy: always (partner tier)

function run(ctx)
  mh_log("event_organizer start", ctx.profile_id)

  local goals = mixhive["db.read"]("artist_goals", { booking_open = true }, 20):await()

  if #goals == 0 then
    mh_log("no booking-open artists found")
    return { status = "ok", suggestions = {}, tasks = {}, notifications = {} }
  end

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

  local event_context = ""
  local opp = mixhive["db.read_one"]("opportunities", { opp_type = "festival" }):await()
  if opp then
    event_context = string.format("Event context: %s | %s | %s",
      opp.title or "Festival", opp.city or "Belgium",
      table.concat(opp.genres or {}, ", "))
  end

  local lineup_prompt = string.format([[
You are a rave booking agent for the Belgian underground electronic scene.
Assemble a 4-act lineup from the available artists.
Roles: headliner (peak time), main support, opener, wildcard (experimental).

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
    table.concat(artist_lines, "\\n")
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
      { role = slot.role, artist_id = g and g.user_id or nil,
        slot_time = slot.slot_time, set_length_min = slot.set_length_min,
        rationale = slot.rationale, event_concept = lineup.event_concept },
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
      notify("Lineup draft ready",
        "4-act lineup assembled - concept: " .. (lineup.event_concept or "TBD"),
        "in_app", "/agents/inbox")
    },
  }
end
`

export const VENUE_FIT = `
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
      i, o.opp_type or "gig", o.title or "?",
      o.city or o.location or "?",
      table.concat(o.genres or {}, ","),
      o.compensation or "?"
    ))
  end

  local score_prompt = string.format([[
You are a DJ booking consultant scoring venue/event fit for an underground artist.
Score based on: genre alignment, location proximity, career stage, compensation fairness.

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
    table.concat(opp_lines, "\\n")
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
        { opportunity_id = opp.id, title = opp.title, opp_type = opp.opp_type,
          city = opp.city or opp.location, fit_score = hit.fit_score,
          genre_match = hit.genre_match, location_notes = hit.location_notes,
          compensation = opp.compensation, deadline = opp.deadline },
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
      notify("Venue fit scores ready",
        "Top match: " .. (booking_opps[1] and booking_opps[1].title or "?") .. " - check your inbox.",
        "in_app", "/agents/inbox")
    } or {},
  }
end
`

export const TREND_INTELLIGENCE = `
-- Trend Intelligence Agent
-- Builds aggregate underground trend reports from mix scores and audio features.
-- Trigger: cron:weekly | approval_policy: auto

function run(ctx)
  mh_log("trend_intelligence start", ctx.profile_id)

  local top_mixes = mixhive["db.read"]("mixes", { published = true }, 100):await()

  if #top_mixes == 0 then
    return { status = "ok", suggestions = {}, tasks = {}, notifications = {} }
  end

  local tag_counts   = {}
  local genre_counts = {}
  for _, m in ipairs(top_mixes) do
    for _, t in ipairs(m.tags   or {}) do tag_counts[t]   = (tag_counts[t]   or 0) + 1 end
    for _, g in ipairs(m.genres or {}) do genre_counts[g] = (genre_counts[g] or 0) + 1 end
  end

  local tag_lines = {}
  for tag, count in pairs(tag_counts) do
    table.insert(tag_lines, { tag = tag, count = count })
  end
  table.sort(tag_lines, function(a, b) return a.count > b.count end)
  local top_tags = {}
  for i, t in ipairs(tag_lines) do
    if i > 10 then break end
    table.insert(top_tags, t.tag .. "(" .. t.count .. ")")
  end

  local genre_lines = {}
  for genre, count in pairs(genre_counts) do
    table.insert(genre_lines, { genre = genre, count = count })
  end
  table.sort(genre_lines, function(a, b) return a.count > b.count end)
  local top_genres = {}
  for i, g in ipairs(genre_lines) do
    if i > 8 then break end
    table.insert(top_genres, g.genre .. "(" .. g.count .. ")")
  end

  local features = mixhive["db.read"]("audio_features", {}, 50):await()
  local bpm_sum, bpm_count, energy_sum, energy_count = 0, 0, 0, 0
  for _, f in ipairs(features) do
    if f.bpm and f.bpm > 0 then bpm_sum = bpm_sum + f.bpm; bpm_count = bpm_count + 1 end
    if f.energy then energy_sum = energy_sum + f.energy; energy_count = energy_count + 1 end
  end
  local avg_bpm    = bpm_count    > 0 and math.floor(bpm_sum / bpm_count) or nil
  local avg_energy = energy_count > 0 and string.format("%.2f", energy_sum / energy_count) or nil

  local trend_prompt = string.format([[
Write a 3-paragraph underground electronic music trend report for Belgium/Western Europe.
Insider tone, no hype. Cover: what's rising, what's fading, one actionable tip for DJs this month.

Platform signals (%d mixes analysed):
Top tags: %s
Top genres: %s
%s
%s
]],
    #top_mixes,
    table.concat(top_tags, ", "):sub(1, 300),
    table.concat(top_genres, ", "):sub(1, 200),
    avg_bpm    and ("Avg BPM: " .. avg_bpm)       or "",
    avg_energy and ("Avg energy: " .. avg_energy) or ""
  )

  local report = mixhive["llm.call"](trend_prompt, "sonnet"):await()

  local payload = {
    report = report, top_tags = top_tags, top_genres = top_genres,
    mix_count = #top_mixes, avg_bpm = avg_bpm, avg_energy = avg_energy,
  }

  mixhive["db.upsert"]("ai_suggestions", {
    owner_id        = ctx.profile_id,
    suggestion_type = "trend_report",
    payload         = payload,
    rationale       = "Weekly aggregate from " .. #top_mixes .. " platform mixes",
    confidence      = 0.80,
    status          = "pending",
    source          = "agent",
    model           = "sonnet",
  }):await()

  mh_log("trend_intelligence report generated")
  return {
    status = "ok",
    suggestions = {
      suggestion("trend_report", payload, 0.80,
        "Weekly aggregate from " .. #top_mixes .. " platform mixes", false)
    },
    tasks = {},
    notifications = {
      notify("Weekly trend report", report:sub(1, 100) .. "...", "in_app", "/agents/inbox")
    },
  }
end
`

export const LABEL_SCOUT = `
-- Label Scout Agent
-- Finds labels and collectives that fit an artist via opportunities + vector search.
-- Trigger: on_demand | approval_policy: on_action (pro tier)

function run(ctx)
  mh_log("label_scout start", ctx.profile_id)

  local profile = mixhive["db.read_one"]("profiles", { id = ctx.profile_id }):await()
  if not profile then
    return { status = "error", message = "profile not found",
             suggestions = {}, tasks = {}, notifications = {} }
  end

  local mixes = mixhive["db.read"]("mixes", { dj_id = ctx.profile_id, published = true }, 5):await()

  local opps = mixhive["db.read"]("opportunities", { is_active = true }, 30):await()
  local label_opps = {}
  for _, o in ipairs(opps) do
    local t = o.opp_type or ""
    if t == "collab_call" or t == "radio" then
      local overlap = false
      for _, og in ipairs(o.genres or {}) do
        for _, pg in ipairs(profile.genres or {}) do
          if og == pg then overlap = true end
        end
      end
      if overlap or #(o.genres or {}) == 0 then
        table.insert(label_opps, o)
      end
    end
  end

  local bio_text = table.concat(profile.genres or {}, " ") .. " " .. (profile.bio or "")
  local similar  = mixhive["vector.search"](bio_text, "profile", 8):await()

  local opp_lines = {}
  for i, o in ipairs(label_opps) do
    if i > 10 then break end
    table.insert(opp_lines, string.format(
      "%d. [%s] %s | %s | organizer: %s | url: %s",
      i, o.opp_type or "?", o.title or "?", o.city or "?",
      o.organizer or "?", o.source_url or "?"
    ))
  end

  local similar_lines = {}
  for i, s in ipairs(similar) do
    if i > 5 then break end
    local meta = s.metadata or {}
    table.insert(similar_lines, string.format("- %s | %s | sim: %.2f",
      meta.display_name or meta.username or "Artist",
      table.concat(meta.genres or {}, ", "),
      s.similarity or 0
    ))
  end

  local fit_prompt = string.format([[
You are a music industry advisor for underground electronic artists.
Identify the 5 best label/collective fits for this artist.

Artist: %s | Location: %s | Genres: %s | Mixes: %d
Bio: %s

Open calls from labels/collectives:
%s

Similar artists on platform (peer signal):
%s

Return JSON only:
{"top_5":[{"label_name":"string","source":"opportunity|inference","opportunity_index":N,"fit_score":N,"pitch_angle":"string"}]}
]],
    profile.display_name or profile.username or "Artist",
    profile.location or "Belgium",
    table.concat(profile.genres or {}, ", "),
    #mixes,
    (profile.bio or ""):sub(1, 200),
    #opp_lines > 0 and table.concat(opp_lines, "\\n") or "None found",
    #similar_lines > 0 and table.concat(similar_lines, "\\n") or "None found"
  )

  local ranked = mixhive["llm.json"](fit_prompt,
    '{"top_5":[{"label_name":string,"source":string,"opportunity_index":number,"fit_score":number,"pitch_angle":string}]}',
    "haiku"
  ):await()

  local suggs = {}
  for _, hit in ipairs(ranked.top_5 or {}) do
    local opp = hit.opportunity_index and label_opps[hit.opportunity_index] or nil
    table.insert(suggs, suggestion(
      "label_fit",
      { label_name = hit.label_name, fit_score = hit.fit_score,
        pitch_angle = hit.pitch_angle, source = hit.source,
        opportunity_id = opp and opp.id or nil,
        source_url = opp and opp.source_url or nil },
      (hit.fit_score or 50) / 100,
      "Label fit based on genre alignment and open call analysis",
      true
    ))
  end

  mh_log("label_scout found " .. #suggs .. " label fits")
  return {
    status        = #suggs > 0 and "needs_approval" or "ok",
    suggestions   = suggs,
    tasks         = #suggs > 0 and {
      task("Research and prepare pitch for top label fit", "high"),
    } or {},
    notifications = #suggs > 0 and {
      notify("Label matches ready",
        "Found " .. #suggs .. " label/collective fits - review pitch angles in your inbox.",
        "in_app", "/agents/inbox")
    } or {},
  }
end
`

export const VISUAL_IDENTITY = `
-- Visual Identity Agent
-- Generates a coherent visual identity brief from profile and press kit data.
-- Trigger: on_demand | approval_policy: always (pro tier)

function run(ctx)
  mh_log("visual_identity start", ctx.profile_id)

  local profile = mixhive["db.read_one"]("profiles", { id = ctx.profile_id }):await()
  if not profile then
    return { status = "error", message = "profile not found",
             suggestions = {}, tasks = {}, notifications = {} }
  end

  local press_kit = mixhive["db.read_one"]("press_kits", { owner_id = ctx.profile_id }):await()
  local pk_context = ""
  if press_kit then
    local payload = press_kit.payload or {}
    pk_context = string.format("Existing press kit: tagline=%s, key_tracks=%s",
      payload.tagline or "none",
      table.concat(payload.key_tracks or {}, ", "))
  end

  local brief_prompt = string.format([[
You are a creative director specialising in underground electronic music visual identities.
Create a precise, actionable visual identity brief. Be specific and atmospheric — no generic advice.

Artist: %s
Location: %s
Genres: %s
DJ Style: %s
Bio: %s
%s

Return JSON only:
{
  "color_palette": ["#hex1", "#hex2", "#hex3"],
  "palette_mood": "string",
  "typography_direction": "string",
  "reference_artists": ["string", "string"],
  "shoot_concept": "string",
  "social_grid_direction": "string",
  "logo_style": "string",
  "avoid": "string"
}
shoot_concept max 2 sentences. Be specific about era, texture, references.
]],
    profile.display_name or profile.username or "Artist",
    profile.location or "Belgium",
    table.concat(profile.genres or {}, ", "),
    profile.dj_style or "DJ/Producer",
    (profile.bio or "No bio provided"):sub(1, 300),
    pk_context
  )

  local brief = mixhive["llm.json"](brief_prompt,
    '{"color_palette":[string],"palette_mood":string,"typography_direction":string,"reference_artists":[string],"shoot_concept":string,"social_grid_direction":string,"logo_style":string,"avoid":string}',
    "sonnet"
  ):await()

  mh_log("visual_identity brief generated")
  return {
    status = "needs_approval",
    suggestions = {
      suggestion("visual_brief", brief, 0.85,
        "Visual identity derived from genre, style, and bio signals", true)
    },
    tasks = { task("Share visual brief with designer or photographer", "medium") },
    notifications = {
      notify("Visual identity brief ready",
        "Your visual direction is ready for review - palette: " .. table.concat(brief.color_palette or {"?"}, ", "),
        "in_app", "/agents/inbox")
    },
  }
end
`

export const COMMUNITY_MANAGER = `
-- Community Manager Agent
-- Drafts warm reply suggestions for unanswered comments on the artist's mixes.
-- Trigger: cron:daily | approval_policy: on_action

function run(ctx)
  mh_log("community_manager start", ctx.profile_id)

  local mixes = mixhive["db.read"]("mixes", { dj_id = ctx.profile_id, published = true }, 5):await()

  if #mixes == 0 then
    return { status = "ok", suggestions = {}, tasks = {}, notifications = {} }
  end

  local profile     = mixhive["db.read_one"]("profiles", { id = ctx.profile_id }):await()
  local artist_name = (profile and (profile.display_name or profile.username)) or "the artist"

  local unanswered = {}
  for _, m in ipairs(mixes) do
    local comments = mixhive["db.read"]("comments", { mix_id = m.id }, 10):await()
    for _, c in ipairs(comments) do
      if c.author_id ~= ctx.profile_id and not c.parent_id then
        table.insert(unanswered, {
          mix_title  = m.title or "untitled mix",
          mix_id     = m.id,
          comment_id = c.id,
          author_id  = c.author_id,
          content    = (c.content or ""):sub(1, 150),
        })
        if #unanswered >= 15 then break end
      end
    end
    if #unanswered >= 15 then break end
  end

  if #unanswered == 0 then
    mh_log("no unanswered comments found")
    return { status = "ok", suggestions = {}, tasks = {}, notifications = {} }
  end

  local comment_lines = {}
  for i, c in ipairs(unanswered) do
    if i > 8 then break end
    table.insert(comment_lines, string.format(
      '%d. [on "%s"] "%s"', i, c.mix_title, c.content
    ))
  end

  local reply_prompt = string.format([[
You are a community manager for an underground DJ.
Draft authentic, warm reply messages. Tone: personal, unpretentious, underground.
Max 40 words per reply. Match energy of the original comment.
Artist name: %s

Comments to reply to:
%s

Return JSON only:
{"replies":[{"index":N,"draft":"string"}]}
Draft up to 5 replies (skip any you cannot improve on).
]],
    artist_name,
    table.concat(comment_lines, "\\n")
  )

  local result = mixhive["llm.json"](reply_prompt,
    '{"replies":[{"index":number,"draft":string}]}',
    "haiku"
  ):await()

  local suggs = {}
  for _, r in ipairs(result.replies or {}) do
    local c = unanswered[r.index]
    if c and r.draft and r.draft ~= "" then
      table.insert(suggs, suggestion(
        "comment_reply_draft",
        { mix_id = c.mix_id, comment_id = c.comment_id,
          mix_title = c.mix_title, original = c.content, draft_reply = r.draft },
        0.70,
        "Drafted reply for unanswered fan comment",
        true
      ))
    end
    if #suggs >= 5 then break end
  end

  mh_log("community_manager drafted " .. #suggs .. " replies")
  return {
    status        = #suggs > 0 and "needs_approval" or "ok",
    suggestions   = suggs,
    tasks         = {},
    notifications = #suggs > 0 and {
      notify("Comment replies ready",
        #suggs .. " draft replies waiting - approve or edit before posting.",
        "in_app", "/agents/inbox")
    } or {},
  }
end
`
