-- set_composer_agent.lua
-- On-demand agent for the Hive Composer "Analyse my set" panel.
-- Trigger: manual   Approval: on_action
-- Input: ctx.event.mix_ids (array), ctx.event.bpm_map ({mix_id → bpm})

local function suggestion(stype, payload, confidence, description, requires_action)
  return {
    suggestion_type = stype,
    payload         = payload,
    confidence      = confidence,
    description     = description,
    requires_action = requires_action or false,
  }
end

function run(ctx)
  local mix_ids = ctx.event and ctx.event.mix_ids or {}
  local bpm_map = ctx.event and ctx.event.bpm_map or {}

  if #mix_ids < 3 then
    return { status = "ok", suggestions = {}, tasks = {}, notifications = {} }
  end

  -- Collect BPM values
  local bpm_values = {}
  for i, mix_id in ipairs(mix_ids) do
    local bpm = bpm_map[mix_id]
    if bpm and type(bpm) == "number" then
      bpm_values[#bpm_values + 1] = bpm
    else
      bpm_values[#bpm_values + 1] = 128  -- fallback
    end
  end

  -- Compute BPM range
  local bpm_min = bpm_values[1]
  local bpm_max = bpm_values[1]
  for _, v in ipairs(bpm_values) do
    if v < bpm_min then bpm_min = v end
    if v > bpm_max then bpm_max = v end
  end
  local bpm_range = bpm_max - bpm_min

  local arc_desc
  if bpm_range <= 5 then
    arc_desc = "steady tempo"
  elseif bpm_range <= 15 then
    arc_desc = "gradual build"
  else
    arc_desc = "dramatic sweep"
  end

  -- Use vector similarity to derive genre context for the first track
  local genre_hint = ""
  if mix_ids[1] then
    local similar = mh.find_similar_mixes(mix_ids[1], 3)
    if similar and #similar > 0 and similar[1] then
      genre_hint = " The opening track has a strong vector signature."
    end
  end

  -- Build LLM prompt
  local prompt = string.format(
    "Analyse this %d-track DJ set with a %s BPM arc (%d→%d BPM).%s " ..
    "Give 1-2 specific observations about the set's flow in plain language. Max 40 words.",
    #mix_ids, arc_desc, bpm_min, bpm_max, genre_hint
  )

  local analysis = ""
  if mh.llm and mh.llm.call then
    analysis = mh.llm.call(prompt, "haiku") or ""
  end

  if analysis == "" then
    analysis = string.format(
      "Your set spans %d BPM with a %s arc over %d tracks.",
      bpm_range, arc_desc, #mix_ids
    )
  end

  return {
    status = "ok",
    suggestions = {
      suggestion(
        "set_analysis",
        { analysis = analysis, mix_count = #mix_ids, bpm_min = bpm_min, bpm_max = bpm_max },
        0.85,
        analysis,
        false
      )
    },
    tasks         = {},
    notifications = {},
  }
end
