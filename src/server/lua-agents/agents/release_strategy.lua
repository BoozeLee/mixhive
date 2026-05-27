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

  -- Gather relevant open opportunities as release context
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
  "optimal_day": "Monday–Sunday"
}
]],
    profile.display_name or profile.username or "Artist",
    profile.location or "Belgium",
    table.concat(profile.genres or {}, ", "),
    #mix_lines > 0 and table.concat(mix_lines, "\n") or "No mixes yet",
    #opp_lines > 0 and table.concat(opp_lines, "\n") or "No open opportunities found"
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
        "Your release plan is ready for review — optimal week: " .. (plan.release_week or "TBD"),
        "in_app",
        "/agents/inbox"
      )
    },
  }
end
