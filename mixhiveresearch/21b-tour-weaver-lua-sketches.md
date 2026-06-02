# Tour Weaver — Minimal Lua Sketches & Agent Notes (Experiment 5)

These are **not** production code yet. They are sketches to show how the data created by the 048 `log_performance` RPC + real gig logging will be consumed by strategic agents.

All sketches assume the `mixhive-lua-agent` skill will be followed before any real implementation.

---

## 1. How Existing Agents Can Immediately Benefit (No New Code Required)

Once users start logging real gigs via the wired GraphSeedingModal:

- `mythic_scene_orbit.lua` and `mythic_collab_weaver.lua` can already read the new `performed_at` edges using the existing `mythic.graph.query` tool (or raw `db.read` on `mythic_edges` with `edge_type = 'performed_at'`).

- `mythic_yield_analyst.lua` will start seeing more high-signal `yielded_outcome` candidates because gigs are now first-class nodes.

No changes needed in the first slice.

---

## 2. Future "Tour Weaver" Agent Sketch (wasmoon strategic)

```lua
-- Future file: src/server/lua-agents/agents/mythic_tour_weaver.lua
-- (Do not create this file yet — this is a design sketch only)

function run(ctx)
  mh_log("mythic_tour_weaver start", ctx.profile_id)

  local profile = mixhive["db.read_one"]("profiles", { id = ctx.profile_id }):await()
  if not profile then return error_response("profile not found") end

  -- Read recent performed_at edges (now populated by real gig logging)
  local recent_gigs = mixhive["db.read"]("mythic_edges", {
    from_node_id = ctx.profile_id,   -- or the artist's profile node
    edge_type = "performed_at"
  }, 20):await() or {}

  -- Read venues the artist has played
  -- (In practice we would join or use a small helper view)

  local prompt = string.format([[
You are the Mythic Tour Weaver — a strategic booking advisor.

Artist: %s
Recent logged performances: %d

Based on their actual performed_at history and the venues that have booked artists with similar trajectories (via graph triangles), propose:

1. 3 specific venues or promoters they should approach in the next 90 days.
2. For each, give one sentence of evidence from their real history.
3. One "stretch" opportunity that is one level above their current rooms.

Return clean JSON.
]], profile.display_name or "artist", #recent_gigs)

  local analysis = mixhive["llm.json"](prompt, nil, "sonnet"):await()

  local suggestions = {}
  -- ... turn analysis into suggestion() objects with provenance ...

  return {
    status = "ok",
    suggestions = suggestions,
    data = analysis
  }
end
```

**Key point:** This agent only becomes valuable *after* the logging flow (this slice) ships and users create real `performed_at` data.

---

## 3. Recommended Minimal Extension to mythicTools (if needed later)

If the Tour Weaver (or Opportunity Scout) needs richer "recent venues for this artist" queries frequently, we can add a thin read-only helper:

```ts
// Future addition to src/server/lua-agents/tools/mythic.ts (only after 048 is live)

'mythic.venues.recent_for_artist': async (profileId: string, limit = 10) => {
  // Efficient query joining mythic_edges (performed_at) → mythic_nodes (venue)
  // Return denormalized list of { venue_name, city, date, role }
}
```

**Do not implement yet.** The existing `mythic.graph.query` is sufficient for the first wave of agents once real data exists.

---

## 4. Recommendation

**Do not invest Lua agent development time until the 21a implementation slice ("Make GraphSeedingModal Real") has shipped and real `performed_at` edges are flowing.**

The highest-leverage work right now is on the data *creation* side (the RPC + modal wiring), not the consumption side.

Once 50–100 artists have logged 5+ real gigs each, then the Tour Weaver agent sketch above becomes a high-ROI next piece of work.

---

**End of sketches.** These can be copied into a real agent file later following the `mixhive-lua-agent` skill.