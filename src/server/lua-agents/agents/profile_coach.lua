-- Profile Coach Agent
-- Scores a DJ/producer profile on 5 axes and surfaces targeted improvements.
-- Trigger: event:profile_updated | cron:weekly | event:user_request

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
Each axis 0-100. Strict scoring: blank bio=0, no avatar=10, no mixes=20.

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

  -- Bio suggestion
  if (score.bio or 0) < 60 then
    local bio_prompt = string.format([[
Write a punchy 3-sentence artist bio for this underground DJ/producer.
Name: %s | Location: %s | Genres: %s
Existing bio: %s
Style: honest, underground, first-person. Max 100 words. Include one memorable hook.
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

  -- Avatar
  if not profile.avatar_url then
    table.insert(suggestions, suggestion(
      "missing_avatar",
      { action = "upload_avatar" },
      1.0,
      "No avatar — promoters skip profiles without a visual identity",
      false
    ))
    table.insert(tasks, task("Upload a profile photo", "high"))
  end

  -- Mixes
  if #mixes == 0 then
    table.insert(suggestions, suggestion(
      "no_mixes",
      { action = "upload_mix" },
      1.0,
      "No published mixes — zero audio evidence of your sound",
      false
    ))
    table.insert(tasks, task("Upload your first mix", "high"))
  end

  -- Social links
  local links = profile.social_links or {}
  if not links.soundcloud and not links.mixcloud and not links.ra then
    table.insert(suggestions, suggestion(
      "missing_social_links",
      { action = "add_links", platforms = {"soundcloud", "ra", "mixcloud"} },
      0.8,
      "No streaming profile linked — promoters cannot verify your presence",
      false
    ))
  end

  -- Score notification
  if (score.overall or 0) < 70 then
    table.insert(notifications, notify(
      "Profile score: " .. tostring(score.overall) .. "/100",
      "Weakest area: " .. (score.weakest or "?") .. ". Improve it to get more bookings.",
      "in_app",
      "/profile/edit"
    ))
  end

  mh_log("done — " .. #suggestions .. " suggestions")
  return {
    status        = #suggestions > 0 and "needs_approval" or "ok",
    suggestions   = suggestions,
    tasks         = tasks,
    notifications = notifications,
  }
end
