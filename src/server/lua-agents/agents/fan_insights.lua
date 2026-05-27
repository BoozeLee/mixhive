-- Fan Insights Agent
-- Clusters audience from likes, play history, and analytics events.
-- Trigger: cron:weekly | approval_policy: auto (pro tier)

function run(ctx)
  mh_log("fan_insights start", ctx.profile_id)

  -- Get user's mixes to join against engagement tables
  local mixes = mixhive["db.read"]("mixes", { dj_id = ctx.profile_id, published = true }, 20):await()

  if #mixes == 0 then
    mh_log("no published mixes found")
    return { status = "ok", suggestions = {}, tasks = {}, notifications = {} }
  end

  -- Aggregate likes across mixes
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

  -- Read analytics events
  local events = mixhive["db.read"]("analytics_events", { profile_id = ctx.profile_id }, 50):await()
  local event_summary = {}
  local event_counts = {}
  for _, e in ipairs(events) do
    local t = e.event_type or "unknown"
    event_counts[t] = (event_counts[t] or 0) + 1
  end
  for t, c in pairs(event_counts) do
    table.insert(event_summary, t .. ": " .. c)
  end

  -- Read follow data
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
    {
      "label": "string",
      "size_pct": N,
      "behaviour": "string",
      "action_tip": "string"
    }
  ],
  "top_performing_tag": "string",
  "growth_insight": "string"
}
]],
    ctx.profile_id,
    #mixes,
    total_likes,
    #followers,
    math.min(#mix_engagement, 10),
    table.concat(mix_engagement, "\n"):sub(1, 800),
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
      suggestion(
        "fan_cluster_report",
        clusters,
        0.80,
        "Audience segmentation from " .. #mixes .. " mixes and " .. #followers .. " followers",
        false
      )
    },
    tasks = {},
    notifications = {
      notify(
        "Fan insights ready",
        "Your audience report is ready — top tag: " .. (clusters.top_performing_tag or "?"),
        "in_app",
        "/agents/inbox"
      )
    },
  }
end
