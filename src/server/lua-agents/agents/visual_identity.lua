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

  -- Check for existing press kit
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
Create a precise, actionable visual identity brief. No generic advice — be specific and atmospheric.

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
All fields required. shoot_concept max 2 sentences. Be specific about era, texture, references.
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
      suggestion(
        "visual_brief",
        brief,
        0.85,
        "Visual identity derived from genre, style, and bio signals",
        true
      )
    },
    tasks = {
      task("Share visual brief with designer or photographer", "medium"),
    },
    notifications = {
      notify(
        "Visual identity brief ready",
        "Your visual direction is ready for review — palette: " .. table.concat(brief.color_palette or {"?"}, ", "),
        "in_app",
        "/agents/inbox"
      )
    },
  }
end
