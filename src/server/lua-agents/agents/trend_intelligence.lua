-- Trend Intelligence Agent
-- Builds aggregate underground trend reports from mix scores and audio features.
-- Trigger: cron:weekly | approval_policy: auto

function run(ctx)
  mh_log("trend_intelligence start", ctx.profile_id)

  -- Top mixes by score
  local top_mixes = mixhive["db.read"]("mixes", { published = true }, 100):await()

  if #top_mixes == 0 then
    return { status = "ok", suggestions = {}, tasks = {}, notifications = {} }
  end

  -- Aggregate tags
  local tag_counts = {}
  local genre_counts = {}
  for _, m in ipairs(top_mixes) do
    for _, t in ipairs(m.tags or {}) do
      tag_counts[t] = (tag_counts[t] or 0) + 1
    end
    for _, g in ipairs(m.genres or {}) do
      genre_counts[g] = (genre_counts[g] or 0) + 1
    end
  end

  -- Top 10 tags
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

  -- Top genres
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

  -- Audio features sample
  local audio_lines = {}
  local features = mixhive["db.read"]("audio_features", {}, 50):await()
  local bpm_sum, bpm_count = 0, 0
  local energy_sum, energy_count = 0, 0
  for _, f in ipairs(features) do
    if f.bpm and f.bpm > 0 then
      bpm_sum   = bpm_sum + f.bpm
      bpm_count = bpm_count + 1
    end
    if f.energy then
      energy_sum   = energy_sum + f.energy
      energy_count = energy_count + 1
    end
  end
  local avg_bpm    = bpm_count    > 0 and math.floor(bpm_sum / bpm_count)       or nil
  local avg_energy = energy_count > 0 and string.format("%.2f", energy_sum / energy_count) or nil

  local trend_prompt = string.format([[
Write a 3-paragraph underground electronic music trend report for Belgium/Western Europe.
Insider tone — as if written for a RA or Resident Advisor news post. No hype, no fluff.
Cover: what's rising, what's fading, one actionable tip for DJs this month.

Platform signals (%d mixes analysed):
Top tags: %s
Top genres: %s
%s
%s
]],
    #top_mixes,
    table.concat(top_tags, ", "):sub(1, 300),
    table.concat(top_genres, ", "):sub(1, 200),
    avg_bpm    and ("Avg BPM: " .. avg_bpm)    or "",
    avg_energy and ("Avg energy: " .. avg_energy) or ""
  )

  local report = mixhive["llm.call"](trend_prompt, "sonnet"):await()

  mh_log("trend_intelligence report generated")

  local payload = {
    report        = report,
    top_tags      = top_tags,
    top_genres    = top_genres,
    mix_count     = #top_mixes,
    avg_bpm       = avg_bpm,
    avg_energy    = avg_energy,
  }

  -- Upsert so repeated runs replace stale reports
  mixhive["db.upsert"]("ai_suggestions", {
    owner_id        = ctx.profile_id,
    suggestion_type = "trend_report",
    payload         = payload,
    rationale       = "Weekly aggregate from " .. #top_mixes .. " platform mixes",
    confidence      = 0.80,
    status          = "pending",
    source          = "agent",
    model           = "sonnet",
    created_at      = os.date("!%Y-%m-%dT%H:%M:%SZ"),
    updated_at      = os.date("!%Y-%m-%dT%H:%M:%SZ"),
  }):await()

  return {
    status = "ok",
    suggestions = {
      suggestion(
        "trend_report",
        payload,
        0.80,
        "Weekly aggregate from " .. #top_mixes .. " platform mixes",
        false
      )
    },
    tasks = {},
    notifications = {
      notify(
        "Weekly trend report",
        report:sub(1, 100) .. "...",
        "in_app",
        "/agents/inbox"
      )
    },
  }
end
