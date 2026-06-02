-- Collaboration Match Agent
-- Finds complementary artists via vector similarity and drafts intro messages.
-- Trigger: on_demand | approval_policy: on_action

function run(ctx)
  mh_log("collaboration_match start", ctx.profile_id)

  local profile = mixhive["db.read_one"]("profiles", { id = ctx.profile_id }):await()
  if not profile then
    return { status = "error", message = "profile not found",
             suggestions = {}, tasks = {}, notifications = {} }
  end

  local bio_text = string.format("%s %s %s %s",
    profile.bio or "",
    table.concat(profile.genres or {}, " "),
    profile.dj_style or "",
    profile.location or ""
  )

  -- Load own structured skills for richer matching context
  local own_skills = mixhive["db.read"]("artist_skills",
    { user_id = ctx.profile_id }, 20
  ):await()
  local skill_names = {}
  for _, sk in ipairs(own_skills or {}) do
    table.insert(skill_names, sk.skill_name)
  end

  local similar = mixhive["vector.search"](bio_text, "profile", 10):await()

  -- Filter out own profile
  local candidates = {}
  for _, s in ipairs(similar) do
    if s.entity_id ~= ctx.profile_id and #candidates < 5 then
      table.insert(candidates, s)
    end
  end

  if #candidates == 0 then
    mh_log("no similar profiles found via vector search")
    return { status = "ok", suggestions = {}, tasks = {}, notifications = {} }
  end

  -- Fetch candidate profiles for richer context
  local candidate_lines = {}
  for i, c in ipairs(candidates) do
    if i > 3 then break end
    local meta = c.metadata or {}
    table.insert(candidate_lines, string.format(
      "%d. %s | genres: %s | location: %s | similarity: %.2f",
      i,
      meta.display_name or meta.username or "Artist " .. i,
      table.concat(meta.genres or {}, ", "),
      meta.location or "?",
      c.similarity or 0
    ))
  end

  local skills_note = #skill_names > 0
    and ("Skills: " .. table.concat(skill_names, ", "))
    or  ""

  local intro_prompt = string.format([[
You are a music community connector for underground electronic music.
Draft a warm, direct intro message from one artist to another — no hype, authentic underground tone.
Max 80 words each. Personalise each to the candidate's genre/location.

Sender: %s | %s | %s
Genres: %s
%s

Candidates:
%s

Return JSON only:
{"intros":[{"index":N,"to_name":"string","message":"string"}]}
]],
    profile.display_name or profile.username or "Artist",
    profile.location or "Belgium",
    profile.dj_style or "DJ",
    table.concat(profile.genres or {}, ", "),
    skills_note,
    table.concat(candidate_lines, "\n")
  )

  local result = mixhive["llm.json"](intro_prompt,
    '{"intros":[{"index":number,"to_name":string,"message":string}]}',
    "haiku"
  ):await()

  local suggs = {}
  for _, intro in ipairs(result.intros or {}) do
    local cand = candidates[intro.index]
    table.insert(suggs, suggestion(
      "collab_intro",
      {
        to_profile_id = cand and cand.entity_id or nil,
        to_name       = intro.to_name,
        draft_message = intro.message,
        similarity    = cand and cand.similarity or 0,
      },
      0.70,
      "Complementary style and genre overlap detected via profile embedding",
      true
    ))
  end

  mh_log("collaboration_match found " .. #suggs .. " matches")

  if not ctx.dry_run then
    for _, sugg in ipairs(suggs) do
      local p = sugg.payload
      if p and p.to_profile_id then
        local ok, err = pcall(function()
          local from_node = mixhive["mythic.node.find_or_create"]({
            node_type    = "artist_profile",
            source_table = "profiles",
            source_id    = ctx.profile_id,
            title        = "Artist",
            owner_id     = ctx.profile_id,
          }):await()
          local to_node = mixhive["mythic.node.find_or_create"]({
            node_type    = "artist_profile",
            source_table = "profiles",
            source_id    = p.to_profile_id,
            title        = p.to_name or "Collaborator",
            owner_id     = ctx.profile_id,
          }):await()
          mixhive["mythic.edge.create"]({
            from_node_id = from_node,
            to_node_id   = to_node,
            edge_type    = "collab_with",
            weight       = p.similarity or 0.5,
            source_event = "collaboration_match",
          }):await()
        end)
        if not ok then mh_log("mythic edge error: " .. tostring(err)) end
      end
    end
  end

  return {
    status        = #suggs > 0 and "needs_approval" or "ok",
    suggestions   = suggs,
    tasks         = {},
    notifications = #suggs > 0 and {
      notify(
        "Collab matches found",
        #suggs .. " artists are a strong fit — review draft intros in your inbox.",
        "in_app",
        "/agents/inbox"
      )
    } or {},
  }
end
