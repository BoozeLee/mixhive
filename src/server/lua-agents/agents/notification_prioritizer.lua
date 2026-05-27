-- Notification Prioritizer Agent
-- Reduces notification noise: picks top 3 highest-priority unread notifications.
-- Trigger: cron:hourly

function run(ctx)
  mh_log("notification_prioritizer start", ctx.profile_id)

  local pending = mixhive["db.read"]("notifications", {
    profile_id = ctx.profile_id,
    read       = false,
  }, 50):await()

  if #pending == 0 then
    return { status = "ok", suggestions = {}, tasks = {}, notifications = {} }
  end

  mh_log("pending=" .. #pending)

  local lines = {}
  for i, n in ipairs(pending) do
    table.insert(lines, string.format("%d. [%s] %s", i, n.type or "?", (n.message or ""):sub(1, 60)))
  end

  local rank_prompt = string.format([[
Rank these %d notifications for a DJ/producer. Select the top 3 by urgency.
Prioritise: deadlines, booking opportunities, grants, direct messages.
De-prioritise: generic likes/follows.
Return JSON: {"top_3_indices":[1,5,12],"digest":"1 sentence summary"}

Notifications:
%s
]],
    #pending,
    table.concat(lines, "\n"):sub(1, 1500)
  )

  local ranked = mixhive["llm.json"](rank_prompt,
    '{"top_3_indices":[number],"digest":string}',
    "haiku"
  ):await()

  local daily_notifs = {}
  for _, idx in ipairs(ranked.top_3_indices or {1}) do
    local n = pending[idx]
    if n then
      table.insert(daily_notifs, notify(
        n.title or "Update",
        n.message or "",
        "in_app",
        n.action_url
      ))
    end
  end

  if ranked.digest then
    table.insert(daily_notifs, notify("Today's digest", ranked.digest, "in_app", "/dashboard"))
  end

  mh_log("surfaced " .. #daily_notifs .. " notifications")
  return {
    status        = "ok",
    suggestions   = {},
    tasks         = {},
    notifications = daily_notifs,
  }
end
