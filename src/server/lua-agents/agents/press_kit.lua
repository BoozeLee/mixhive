-- Press Kit Agent
-- Generates a complete EPK for the artist. Trigger: event:user_request

function run(ctx)
  mh_log("press_kit start", ctx.profile_id)

  local profile = mixhive["db.read_one"]("profiles", { id = ctx.profile_id }):await()
  if not profile then return { status = "error", message = "profile not found",
    suggestions = {}, tasks = {}, notifications = {} } end

  local mixes = mixhive["db.read"]("mixes", { dj_id = ctx.profile_id, published = true }, 3):await()

  local epk_prompt = string.format([[
Write a professional Electronic Press Kit for an underground DJ/producer.
Return JSON only — no backticks or markdown.
{
  "headline": "one punchy sentence",
  "bio_short": "max 80 words",
  "bio_long": "max 200 words",
  "genre_tags": ["tag1","tag2"],
  "technical_rider_stub": "4-line standard rider",
  "booking_email_template": "short email template with subject line",
  "press_quote": "[PLACEHOLDER — replace with real press quote]"
}
Artist: %s | Location: %s | Genres: %s
Bio: %s
Published mixes: %d
]],
    profile.display_name or "Artist",
    profile.location or "Belgium",
    table.concat(profile.genres or {}, ", "),
    (profile.bio or ""):sub(1, 400),
    #mixes
  )

  local epk = mixhive["llm.json"](epk_prompt,
    '{"headline":string,"bio_short":string,"bio_long":string,"genre_tags":["string"],"technical_rider_stub":string,"booking_email_template":string,"press_quote":string}',
    "sonnet"
  ):await()

  -- Merge real social links
  epk.social_links = profile.social_links or {}

  if not ctx.dry_run then
    mixhive["db.upsert"]("press_kits", {
      profile_id   = ctx.profile_id,
      version      = 1,
      content_json = epk,
      public_slug  = ctx.profile_id,
    }):await()
  end

  mh_log("EPK generated")
  return {
    status = "needs_approval",
    suggestions = {
      suggestion(
        "press_kit_generated",
        { epk = epk, public_url = "/epk/" .. ctx.profile_id },
        0.95,
        "EPK generated from your profile — review before sharing",
        true
      )
    },
    tasks = { task("Review and publish your Press Kit", "high") },
    notifications = {
      notify("Your Press Kit is ready", "Review and share with promoters.", "in_app", "/dashboard/press-kit")
    },
  }
end
