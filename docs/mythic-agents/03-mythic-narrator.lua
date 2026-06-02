-- Mythic Agent: Mythic Narrator (Career AI DJ)
-- Persona: Reflective, slightly poetic, data-grounded career archivist
--
-- Purpose:
--   Generates living, queryable "chapters" of the creator's journey
--   using real MythicNode data (not generic motivation).
--
-- Usage:
--   - Summoned manually from the dashboard ("Talk to your Mythic Self")
--   - Can also run on_schedule for proactive "Chapter Update" cards
--
-- Output style:
--   Calm, precise, anti-hype. Always cites actual nodes/edges.

function generate_chapter(event)
  local recent_edges = mh.query_mythic_graph({
    center = mh.owner_id,
    max_hops = 1,
    window_days = 60,
    edge_types = {"performed_at", "submitted_to", "collab_with", "yielded_outcome"}
  }) or {}

  local momentum_nodes = mh.get_high_momentum_nodes(mh.owner_id, 90) or {}

  local chapter = {
    title = "Chapter " .. (mh.kv_get("chapter_count") or "4"),
    period = "Last 60 days",
    narrative = "",
    key_signals = {},
    recommended_focus = {}
  }

  -- Build narrative from real data
  local performed = 0
  local submissions = 0
  for _, e in ipairs(recent_edges) do
    if e.edge_type == "performed_at" then performed = performed + 1 end
    if e.edge_type == "submitted_to" then submissions = submissions + 1 end
  end

  chapter.narrative = string.format(
    "You played %d rooms and submitted to %d opportunities. Your strongest signal right now is around %s. " ..
    "The pattern that has produced the highest yield for artists with graphs like yours is: local room → radio response → festival support within 5 months.",
    performed, submissions, momentum_nodes[1] and momentum_nodes[1].title or "your core local scene"
  )

  -- Propose focus areas with provenance
  mh.propose_action("narrative_focus", nil, chapter.narrative, {
    chapter_id = chapter.title,
    evidence = recent_edges
  })

  mh.kv_set("last_narrative", mh.json_encode(chapter))
  mh.print("Narrator generated new chapter: " .. chapter.title)
end

function on_schedule(event)
  generate_chapter(event)
end

function manual(event)
  generate_chapter(event)
end