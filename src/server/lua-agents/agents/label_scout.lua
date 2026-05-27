-- Label Scout Agent
-- Finds labels and collectives that fit an artist via opportunities + vector search.
-- Trigger: on_demand | approval_policy: on_action (pro tier)

function run(ctx)
  mh_log("label_scout start", ctx.profile_id)

  local profile = mixhive["db.read_one"]("profiles", { id = ctx.profile_id }):await()
  if not profile then
    return { status = "error", message = "profile not found",
             suggestions = {}, tasks = {}, notifications = {} }
  end

  local mixes = mixhive["db.read"]("mixes", { dj_id = ctx.profile_id, published = true }, 5):await()

  -- Collab-call and radio opportunities often represent labels/collectives
  local opps = mixhive["db.read"]("opportunities", { is_active = true }, 30):await()
  local label_opps = {}
  for _, o in ipairs(opps) do
    local t = o.opp_type or ""
    if t == "collab_call" or t == "radio" then
      -- Check genre overlap
      local overlap = false
      for _, og in ipairs(o.genres or {}) do
        for _, pg in ipairs(profile.genres or {}) do
          if og == pg then overlap = true end
        end
      end
      if overlap or #(o.genres or {}) == 0 then
        table.insert(label_opps, o)
      end
    end
  end

  -- Vector search for established artists/labels in same space
  local bio_text = string.format("%s %s",
    table.concat(profile.genres or {}, " "),
    profile.bio or ""
  )
  local similar = mixhive["vector.search"](bio_text, "profile", 8):await()

  local opp_lines = {}
  for i, o in ipairs(label_opps) do
    if i > 10 then break end
    table.insert(opp_lines, string.format(
      "%d. [%s] %s | %s | organizer: %s | url: %s",
      i, o.opp_type or "?",
      o.title or "?",
      o.city or "?",
      o.organizer or "?",
      o.source_url or "?"
    ))
  end

  local similar_lines = {}
  for i, s in ipairs(similar) do
    if i > 5 then break end
    local meta = s.metadata or {}
    table.insert(similar_lines, string.format(
      "- %s | %s | sim: %.2f",
      meta.display_name or meta.username or "Artist",
      table.concat(meta.genres or {}, ", "),
      s.similarity or 0
    ))
  end

  local fit_prompt = string.format([[
You are a music industry advisor for underground electronic artists.
Identify the 5 best label/collective fits for this artist.
Use both the open calls and peer artist signals to identify which imprints would be interested.

Artist: %s | Location: %s | Genres: %s | Mixes: %d
Bio: %s

Open calls from labels/collectives:
%s

Similar artists on platform (peer signal):
%s

Return JSON only:
{
  "top_5": [
    {
      "label_name": "string",
      "source": "opportunity|inference",
      "opportunity_index": N or null,
      "fit_score": N,
      "pitch_angle": "string"
    }
  ]
}
]],
    profile.display_name or profile.username or "Artist",
    profile.location or "Belgium",
    table.concat(profile.genres or {}, ", "),
    #mixes,
    (profile.bio or ""):sub(1, 200),
    #opp_lines > 0 and table.concat(opp_lines, "\n") or "None found",
    #similar_lines > 0 and table.concat(similar_lines, "\n") or "None found"
  )

  local ranked = mixhive["llm.json"](fit_prompt,
    '{"top_5":[{"label_name":string,"source":string,"opportunity_index":number,"fit_score":number,"pitch_angle":string}]}',
    "haiku"
  ):await()

  local suggs = {}
  for _, hit in ipairs(ranked.top_5 or {}) do
    local opp = hit.opportunity_index and label_opps[hit.opportunity_index] or nil
    table.insert(suggs, suggestion(
      "label_fit",
      {
        label_name      = hit.label_name,
        fit_score       = hit.fit_score,
        pitch_angle     = hit.pitch_angle,
        source          = hit.source,
        opportunity_id  = opp and opp.id or nil,
        source_url      = opp and opp.source_url or nil,
      },
      (hit.fit_score or 50) / 100,
      "Label fit based on genre alignment and open call analysis",
      true
    ))
  end

  mh_log("label_scout found " .. #suggs .. " label fits")

  return {
    status        = #suggs > 0 and "needs_approval" or "ok",
    suggestions   = suggs,
    tasks         = #suggs > 0 and {
      task("Research and prepare pitch for top label fit", "high"),
    } or {},
    notifications = #suggs > 0 and {
      notify(
        "Label matches ready",
        "Found " .. #suggs .. " label/collective fits — review pitch angles in your inbox.",
        "in_app",
        "/agents/inbox"
      )
    } or {},
  }
end
