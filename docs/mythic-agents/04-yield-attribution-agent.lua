-- Mythic Agent: Yield & Attribution Analyst
-- Persona: Cold, honest, pattern-obsessed career scientist
--
-- Purpose:
--   Answers the question almost no other platform can:
--   "Which of my actual actions over the last N months produced real
--    career outcomes (bookings, responses, releases, meaningful relationships)?"
--
-- This is the engine that makes the whole MythicNode flywheel valuable.

function weekly_yield_review(event)
  local summary = mh.get_yield_summary(mh.owner_id, 180) or {}

  if not summary.top_patterns or #summary.top_patterns == 0 then
    mh.notify("Not enough outcome data yet. Keep logging real gigs, responses, and collabs — this agent becomes powerful after ~6-8 attributed outcomes.")
    return
  end

  for i, pattern in ipairs(summary.top_patterns) do
    if i > 3 then break end

    local msg = string.format(
      "Highest yield pattern detected: %s (%.1fx baseline conversion for similar artists). " ..
      "You have done this %d times with %d documented positive outcomes.",
      pattern.description,
      pattern.lift or 1.0,
      pattern.times_done or 0,
      pattern.positive_outcomes or 0
    )

    mh.propose_action("double_down", pattern.signature_node_ids, msg, {
      expected_impact = pattern.lift,
      supporting_outcomes = pattern.outcome_edge_ids
    })
  end

  -- Also surface the "quiet killers" (actions with high effort, near-zero yield)
  if summary.low_yield_patterns then
    for _, bad in ipairs(summary.low_yield_patterns) do
      mh.notify("Low-yield pattern: " .. bad.description .. " — consider deprioritizing.")
    end
  end

  mh.print("Yield review complete. " .. #summary.top_patterns .. " strong patterns surfaced.")
end

function on_schedule(event)
  weekly_yield_review(event)
end

function manual(event)
  weekly_yield_review(event)
end