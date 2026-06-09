-- set_composer_agent.lua
-- On-demand agent for the Hive Composer "Analyse my set" panel.
-- Runtime: wasmoon (AgentRegistry). Trigger: event:user_request. Approval: auto.
-- Input: ctx.context.mix_ids (array), ctx.context.bpm_map ({mix_id -> bpm})

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
  local input = ctx.context or {}
  local mix_ids = input.mix_ids or {}
  local bpm_map = input.bpm_map or {}

  if #mix_ids < 3 then
    return { status = "ok", suggestions = {}, tasks = {}, notifications = {} }
  end

  -- Collect BPM values (fallback 128 when a track has no detected BPM).
  local bpm_values = {}
  for i, mix_id in ipairs(mix_ids) do
    local bpm = bpm_map[mix_id]
    if bpm and type(bpm) == "number" then
      bpm_values[#bpm_values + 1] = bpm
    else
      bpm_values[#bpm_values + 1] = 128
    end
  end

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

  local prompt = string.format(
    "Analyse this %d-track DJ set with a %s BPM arc (%d->%d BPM). " ..
    "Give 1-2 specific observations about the set's flow in plain language. Max 40 words.",
    #mix_ids, arc_desc, bpm_min, bpm_max
  )

  -- LLM is optional: llm.call throws when OPENAI_API_KEY is unset (no-paid-API
  -- mode), so guard it and fall back to a deterministic summary.
  local analysis = ""
  local ok, res = pcall(function()
    return mixhive["llm.call"](prompt, "haiku"):await()
  end)
  if ok and type(res) == "string" then
    analysis = res
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
