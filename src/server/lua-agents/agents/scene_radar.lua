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

  local suggestions = {
    suggestion(
      "scene_digest",
      { city = city, digest = digest },
      0.75,
      "Weekly platform-wide underground scene intelligence",
      false
    )
  }

  -- Web3 branch: propose supporter pass for a high-play mix with no collection
  local my_mixes = mixhive["db.read"]("mixes", { dj_id = ctx.profile_id, published = true }, 10):await() or {}
  for _, mx in ipairs(my_mixes) do
    local play_count = mx.play_count or 0
    if play_count > 300 then
      local existing = mixhive["db.read"]("nft_collections", {
        owner_id = ctx.profile_id, mix_id = mx.id
      }, 1):await() or {}
      if #existing == 0 then
        table.insert(suggestions, suggestion(
          "web3_proposal",
          {
            action = "create_pass",
            source_type = "mix",
            source_id = mx.id,
            reason_template = "Your mix has {play_count} plays and no supporter pass yet.",
            estimated_supply = 50,
            context_stats = { play_count = play_count }
          },
          0.8,
          "Mix '" .. (mx.title or "?") .. "' has " .. play_count .. " plays with no supporter pass",
          true
        ))
        break
      end
    end
  end

  return {
    status = "ok",
    suggestions = suggestions,
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
