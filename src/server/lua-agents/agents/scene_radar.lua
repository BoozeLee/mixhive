-- Scene Radar Agent
-- Weekly underground scene digest for the artist's city. Trigger: cron:daily

function run(ctx)
  mh_log("scene_radar start", ctx.profile_id)

  local profile = mixhive["db.read_one"]("profiles", { id = ctx.profile_id }):await()
  local city    = (profile and profile.location) or "Brussels"

  -- Use recent mixes from that city as trend signal
  local recent_mixes = mixhive["db.read"]("mixes", { published = true }, 50):await()

  local genre_counts = {}
  for _, m in ipairs(recent_mixes) do
    local tags = m.tags or {}
    for _, tag in ipairs(tags) do
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
Write a 2-paragraph underground music scene digest based on these genre play signals.
Format: insider tone, casual, no hype. Include what is rising, one actionable tip for a DJ.
Max 150 words.

Signals:
%s
]],
    table.concat(trend_lines, "\n"):sub(1, 600)
  )

  local digest = mixhive["llm.call"](digest_prompt, "sonnet"):await()

  mh_log("digest generated")
  return {
    status = "ok",
    suggestions = {
      suggestion(
        "scene_digest",
        { city = city, digest = digest },
        0.75,
        "Weekly platform-wide underground scene intelligence",
        false
      )
    },
    tasks = {},
    notifications = {
      notify(
        "Scene update",
        digest:sub(1, 100) .. "...",
        "in_app",
        "/dashboard"
      )
    },
  }
end
