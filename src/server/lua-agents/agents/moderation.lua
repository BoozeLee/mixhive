-- Moderation Agent
-- Screens content for harmful signals. Underground-culture-aware.
-- Trigger: event:content_created

function run(ctx)
  local content_id   = ctx.context and ctx.context.content_id
  local content_type = ctx.context and ctx.context.content_type or "post"
  mh_log("moderation start", content_type, content_id)

  if not content_id then return { status = "error", message = "no content_id",
    suggestions = {}, tasks = {}, notifications = {} } end

  local content = mixhive["db.read_one"](content_type .. "s", { id = content_id }):await()
  if not content then return { status = "error", message = "content not found",
    suggestions = {}, tasks = {}, notifications = {} } end

  local text = content.body or content.description or content.bio or ""

  local mod_prompt = string.format([[
Moderate content for an underground electronic music platform. Return JSON only:
{"action":"allow"|"warn"|"hide"|"escalate","severity":0-10,
 "flags":["hate_speech"|"spam"|"fraud"|"doxxing"|"harassment"|"none"],
 "reason":"1 sentence"}

Context: drug references in harm-reduction context, profanity, adult themes,
rave culture language are NORMAL here. Only flag: hate speech based on protected
characteristics, fraud, doxxing, CSAM, violent threats.

Content type: %s
Text: %s
]],
    content_type,
    text:sub(1, 800)
  )

  local result = mixhive["llm.json"](mod_prompt,
    '{"action":string,"severity":number,"flags":["string"],"reason":string}',
    "haiku"
  ):await()

  mh_log("action=" .. (result.action or "?") .. " severity=" .. tostring(result.severity))

  if not ctx.dry_run then
    mixhive["db.insert"]("moderation_signals", {
      source_table  = content_type .. "s",
      source_id     = content_id,
      signal_type   = table.concat(result.flags or {}, ","),
      severity      = result.severity or 0,
      action_taken  = result.action or "allow",
    }):await()

    if result.action == "hide" or result.action == "escalate" then
      mixhive["db.update"](content_type .. "s", { id = content_id }, {
        moderation_status = result.action,
        moderation_reason = result.reason,
      }):await()
    end
  end

  local suggestions = {}
  if result.action == "escalate" then
    table.insert(suggestions, suggestion(
      "moderation_escalation",
      { content_id = content_id, content_type = content_type, result = result },
      1.0,
      result.reason,
      true
    ))
  end

  return {
    status        = result.action == "escalate" and "needs_approval" or "ok",
    suggestions   = suggestions,
    tasks         = {},
    notifications = {},
  }
end
