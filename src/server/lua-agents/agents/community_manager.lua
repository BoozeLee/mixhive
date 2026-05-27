-- Community Manager Agent
-- Drafts warm reply suggestions for unanswered comments on the artist's mixes.
-- Trigger: cron:daily | approval_policy: on_action

function run(ctx)
  mh_log("community_manager start", ctx.profile_id)

  local mixes = mixhive["db.read"]("mixes", { dj_id = ctx.profile_id, published = true }, 5):await()

  if #mixes == 0 then
    return { status = "ok", suggestions = {}, tasks = {}, notifications = {} }
  end

  local profile = mixhive["db.read_one"]("profiles", { id = ctx.profile_id }):await()
  local artist_name = (profile and (profile.display_name or profile.username)) or "the artist"

  -- Collect unanswered comments across mixes
  local unanswered = {}
  for _, m in ipairs(mixes) do
    local comments = mixhive["db.read"]("comments", { mix_id = m.id }, 10):await()
    for _, c in ipairs(comments) do
      -- Only include top-level comments not authored by the artist
      if c.author_id ~= ctx.profile_id and not c.parent_id then
        table.insert(unanswered, {
          mix_title   = m.title or "untitled mix",
          mix_id      = m.id,
          comment_id  = c.id,
          author_id   = c.author_id,
          content     = (c.content or ""):sub(1, 150),
        })
        if #unanswered >= 15 then break end
      end
    end
    if #unanswered >= 15 then break end
  end

  if #unanswered == 0 then
    mh_log("no unanswered comments found")
    return { status = "ok", suggestions = {}, tasks = {}, notifications = {} }
  end

  local comment_lines = {}
  for i, c in ipairs(unanswered) do
    if i > 8 then break end
    table.insert(comment_lines, string.format(
      '%d. [on "%s"] "%s"',
      i, c.mix_title, c.content
    ))
  end

  local reply_prompt = string.format([[
You are a community manager for an underground DJ. Draft authentic, warm reply messages.
Tone: personal, unpretentious, underground — not corporate or fan-service-y.
Max 40 words per reply. Match energy of the original comment.
Artist name: %s

Comments to reply to:
%s

Return JSON only:
{"replies":[{"index":N,"draft":"string"}]}
Draft up to 5 replies (skip any you can't improve on).
]],
    artist_name,
    table.concat(comment_lines, "\n")
  )

  local result = mixhive["llm.json"](reply_prompt,
    '{"replies":[{"index":number,"draft":string}]}',
    "haiku"
  ):await()

  local suggs = {}
  for _, r in ipairs(result.replies or {}) do
    local c = unanswered[r.index]
    if c and r.draft and r.draft ~= "" then
      table.insert(suggs, suggestion(
        "comment_reply_draft",
        {
          mix_id      = c.mix_id,
          comment_id  = c.comment_id,
          mix_title   = c.mix_title,
          original    = c.content,
          draft_reply = r.draft,
        },
        0.70,
        "Drafted reply for unanswered fan comment",
        true
      ))
    end
    if #suggs >= 5 then break end
  end

  mh_log("community_manager drafted " .. #suggs .. " replies")

  return {
    status        = #suggs > 0 and "needs_approval" or "ok",
    suggestions   = suggs,
    tasks         = {},
    notifications = #suggs > 0 and {
      notify(
        "Comment replies ready",
        #suggs .. " draft replies waiting — approve or edit before posting.",
        "in_app",
        "/agents/inbox"
      )
    } or {},
  }
end
