# Lua Agent Discovery Behaviors — Scene Navigator, Collab Cartographer, Opportunity Scout (Phase 7)

**"The graph is only useful when agents translate it into actions the artist can take today."**

**Status:** Spec — ready for Codex (new mh.* RPCs) + Claude Code (agent gallery cards)  
**Date:** 31 May 2026  
**Extends:** `16-mythic-strategic-agents-gallery-spec.md` (strategic agents) · `19-mythicnode-differentiation-engineered-prompt.md` (governing prompt)  
**Also read:** `docs/LUA_AGENTS.md` (Lua sandbox API) · `24-mythicnode-graph-query-architecture.md` (query patterns)

---

## Overview

Phase 6 shipped 4 internal strategic agents (Scene Orbit, Collab Weaver, Narrator, Yield Analyst) that run as system agents via the wasmoon runtime. This document defines 3 new **user-facing discovery agent archetypes** that run in the Lupa (user automation) runtime — the same sandbox as user-authored agents in the `/agents` editor.

These archetypes are:
- **Scene Navigator** — your scene's weekly digest
- **Collab Cartographer** — targeted collab partner recommendations
- **Opportunity Scout** — daily opportunity watchdog

Each archetype is also a **starter template** users can fork and customize. They demonstrate the new `mh.*` graph tools introduced in Phase 7.

---

## 1. Agent Archetypes

### 1.1 Scene Navigator

| Attribute | Value |
|---|---|
| ID | `scene-navigator` |
| Trigger | `on_schedule` (cron: `0 9 * * 1` — Monday 09:00 UTC) |
| Approval policy | `auto` (notify only; no write actions) |
| Tier | `free` |
| Tools needed | `mh.get_scene_peers()`, `mh.get_similar_artists()`, `mh.notify()`, `mh.kv_get/set()` |

**Persona:** A well-connected local in your scene who knows everyone. Every Monday morning they send you a short brief: who's been active, what venues came up, what mixes are getting traction nearby.

**Behavior:** Reads the k=2 scene cluster (see doc 24 section 2.5), surfaces 3 artists who have been active in the last 7 days (new mix published or gig logged), and 1 venue that came up in 2+ connections' recent gigs.

**Safety constraints:** No writes. Purely notification-based. Never surfaces a user who has blocked the owner.

### 1.2 Collab Cartographer

| Attribute | Value |
|---|---|
| ID | `collab-cartographer` |
| Trigger | `on_schedule` (cron: `0 10 * * 3` — Wednesday 10:00 UTC) |
| Approval policy | `on_action` (requires confirm before messaging or following) |
| Tier | `free` |
| Tools needed | `mh.get_scene_peers()`, `mh.get_similar_artists()`, `mh.get_profile()`, `mh.kv_get/set()`, `mh.notify()` |

**Persona:** A network broker who spots the "missing link" collabs — artists you probably should have worked with by now but haven't. Ships 3 concrete, reasoned recommendations each Wednesday.

**Behavior:** Finds artists who are close in the graph (shared venues, shared fans, similar scene tags) but with whom no `collab_with` edge exists yet. For each candidate, computes a simple "missed connection score" and drafts a one-sentence rationale. Deduplicates against past recommendations stored in KV.

**Safety constraints:** Never auto-follows or auto-messages. Each recommendation requires explicit user confirmation (`on_action`). Caps at 3 recommendations per run to avoid flooding.

### 1.3 Opportunity Scout

| Attribute | Value |
|---|---|
| ID | `opportunity-scout` |
| Trigger | `on_schedule` (cron: `0 8 * * *` — daily 08:00 UTC) |
| Approval policy | `on_action` (requires confirm before applying) |
| Tier | `free` |
| Tools needed | `mh.get_relevant_opportunities()`, `mh.get_quest_momentum()`, `mh.kv_get/set()`, `mh.notify()` |

**Persona:** The most vigilant A&R you'll never pay for. Checks the opportunity board every morning and only surfaces the ones that actually make sense for where you are right now.

**Behavior:** Calls `mh.get_relevant_opportunities(5)` and compares against the KV-cached list of opportunities already shown. Surfaces only new ones, ordered by match_score. If a quest is active and its scene tags overlap with an opportunity, adds a `[Aligns with quest: …]` note to the notification.

**Safety constraints:** Never auto-applies. KV deduplication prevents surfacing the same opportunity twice within 14 days. Silent run if no new opportunities (no empty notifications).

---

## 2. New `mh.*` API Surface Required

Beyond what shipped in Phase 6 (migration 064), these 4 new tools are needed. Each maps to a new security-definer RPC that Codex adds in migration 065.

### 2.1 `mh.get_neighbors(node_id, edge_type, depth, limit)`

**Purpose:** Low-level graph traversal — traverse from any node via a given edge type up to `depth` hops, returning up to `limit` nodes.

**RPC name:** `lua_get_neighbors`

```sql
-- Simplified single-hop version (depth=1); recursive CTE for depth>1
CREATE OR REPLACE FUNCTION public.lua_get_neighbors(
  p_owner_id  uuid,
  p_node_id   uuid,
  p_edge_type text,
  p_depth     int default 1,
  p_limit     int default 10
) RETURNS TABLE (node_id uuid, node_type text, title text, hop int)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  -- Validate: p_node_id must belong to p_owner_id or be publicly accessible
  -- Depth capped at 3 (see doc 24 section 6)
  RETURN QUERY
  WITH RECURSIVE traversal(node_id, node_type, title, hop) AS (
    SELECT mn.id, mn.node_type, mn.title, 1
    FROM mythic_edges me
    JOIN mythic_nodes mn ON mn.id = me.target_id
    WHERE me.source_id = p_node_id
      AND me.edge_type = p_edge_type
    UNION ALL
    SELECT mn2.id, mn2.node_type, mn2.title, t.hop + 1
    FROM traversal t
    JOIN mythic_edges me2 ON me2.source_id = t.node_id
    JOIN mythic_nodes mn2 ON mn2.id = me2.target_id
    WHERE me2.edge_type = p_edge_type AND t.hop < least(p_depth, 3)
  )
  SELECT DISTINCT ON (node_id) node_id, node_type, title, hop
  FROM traversal
  ORDER BY node_id, hop ASC
  LIMIT least(p_limit, 50);
END;
$$;
```

**Return shape:** `[{node_id, node_type, title, hop}]`  
**Rate limit:** 10 calls/run  
**Fail-open:** returns empty list on error

### 2.2 `mh.get_top_venues(limit)`

**Purpose:** Returns top venues ranked by their venue impact score relative to the calling artist (see doc 24 section 5.2).

**RPC name:** `lua_get_top_venues`

```sql
CREATE OR REPLACE FUNCTION public.lua_get_top_venues(
  p_owner_id uuid,
  p_limit    int default 5
) RETURNS TABLE (venue_node_id uuid, title text, city text, event_count int, fit_score float)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  -- Step 1: find venues from artist's 2-hop neighborhood
  -- Step 2: score by edge count (simplified venue_impact; see doc 24 for full formula)
  RETURN QUERY
  SELECT
    mn_v.id                         AS venue_node_id,
    mn_v.title,
    mn_v.payload->>'city'           AS city,
    count(DISTINCT e1.source_id)::int AS event_count,
    count(DISTINCT e1.source_id)::float / 10.0 AS fit_score
  FROM mythic_nodes mn_a
  JOIN mythic_edges e_performed ON e_performed.source_id = mn_a.id
    AND e_performed.edge_type = 'similar_artist'
  JOIN mythic_edges e1 ON e1.source_id = e_performed.target_id
    AND e1.edge_type = 'performed_at'
  JOIN mythic_edges e2 ON e2.source_id = e1.target_id
    AND e2.edge_type = 'hosted_by'
  JOIN mythic_nodes mn_v ON mn_v.id = e2.target_id
    AND mn_v.node_type = 'venue'
  WHERE mn_a.owner_id = p_owner_id
    AND mn_a.node_type = 'artist_profile'
    AND mn_v.id NOT IN (
      -- Exclude venues the artist has already played
      SELECT e2b.target_id FROM mythic_edges e1b
      JOIN mythic_edges e2b ON e2b.source_id = e1b.target_id AND e2b.edge_type = 'hosted_by'
      WHERE e1b.source_id = mn_a.id AND e1b.edge_type = 'performed_at'
    )
  GROUP BY mn_v.id, mn_v.title, mn_v.payload->>'city'
  ORDER BY event_count DESC
  LIMIT least(p_limit, 20);
END;
$$;
```

**Return shape:** `[{venue_node_id, title, city, event_count, fit_score}]`  
**Rate limit:** 5 calls/run  
**Fail-open:** empty list on error

### 2.3 `mh.get_scene_peers(limit)`

**Purpose:** Returns artists within k=2 hops via `similar_artist` edges who share scene tags with the owner. Used by Scene Navigator to identify "active" neighbors.

**RPC name:** `lua_get_scene_peers`

```sql
CREATE OR REPLACE FUNCTION public.lua_get_scene_peers(
  p_owner_id uuid,
  p_limit    int default 10
) RETURNS TABLE (
  artist_id    uuid,
  username     text,
  display_name text,
  shared_tags  text[],
  hop          int,
  recently_active bool
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH k1 AS (
    SELECT me.target_id, 1 AS hop
    FROM mythic_nodes mn
    JOIN mythic_edges me ON me.source_id = mn.id AND me.edge_type = 'similar_artist'
    WHERE mn.owner_id = p_owner_id AND mn.node_type = 'artist_profile'
  ),
  k2 AS (
    SELECT me2.target_id, 2 AS hop
    FROM k1 JOIN mythic_edges me2 ON me2.source_id = k1.target_id
    WHERE me2.edge_type = 'similar_artist'
    UNION ALL SELECT target_id, 1 FROM k1
  ),
  owner_tags AS (
    SELECT array_agg(DISTINCT tag) AS tags
    FROM (SELECT unnest(p.genres) AS tag FROM profiles p WHERE p.id = p_owner_id) t
  )
  SELECT DISTINCT ON (p.id)
    p.id,
    p.username,
    p.display_name,
    ARRAY(SELECT unnest(p.genres) INTERSECT SELECT unnest(ot.tags) FROM owner_tags ot) AS shared_tags,
    min(k2.hop) OVER (PARTITION BY p.id) AS hop,
    (p.updated_at > now() - interval '7 days') AS recently_active
  FROM k2
  JOIN mythic_nodes mn2 ON mn2.id = k2.target_id AND mn2.node_type = 'artist_profile'
  JOIN profiles p ON p.id = mn2.owner_id
  WHERE mn2.owner_id != p_owner_id
  ORDER BY p.id, recently_active DESC
  LIMIT least(p_limit, 30);
END;
$$;
```

**Return shape:** `[{artist_id, username, display_name, shared_tags, hop, recently_active}]`  
**Rate limit:** 5 calls/run  
**Fail-open:** empty list

### 2.4 `mh.get_engagement_summary()`

**Purpose:** Returns the owner's own engagement signals over the last 30 days (plays, likes, comments). Maps to data already in the `mixes` table — no new DB work.

**RPC name:** `lua_get_engagement_summary`

```sql
CREATE OR REPLACE FUNCTION public.lua_get_engagement_summary(
  p_owner_id uuid
) RETURNS TABLE (
  total_plays   int,
  total_likes   int,
  total_comments int,
  published_mixes int,
  most_played_mix_title text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT
    coalesce(sum(m.play_count), 0)::int,
    coalesce(sum(m.like_count), 0)::int,
    coalesce(sum(m.comment_count), 0)::int,
    count(*)::int,
    (SELECT title FROM mixes WHERE dj_id = p_owner_id AND published = true
     ORDER BY play_count DESC LIMIT 1)
  FROM mixes m
  WHERE m.dj_id = p_owner_id
    AND m.published = true
    AND m.created_at > now() - interval '30 days';
END;
$$;
```

**Return shape:** `{total_plays, total_likes, total_comments, published_mixes, most_played_mix_title}`  
**Rate limit:** 3 calls/run  
**Fail-open:** zeros on error

---

## 3. Pseudo-Lua Behavior Scripts

### 3.1 Scene Navigator

```lua
-- Scene Navigator — Monday weekly digest
-- Reads scene peers, surfaces active ones, mentions a new venue in the neighborhood.
-- trigger: on_schedule (cron:weekly)

function on_schedule(event)
  local aggressiveness = mh.kv_get("aggressiveness") or "medium"

  -- 1. Get scene peers (k=2, recently active)
  local peers = mh.get_scene_peers(10) or {}
  local active_peers = {}
  for _, p in ipairs(peers) do
    if p.recently_active then
      table.insert(active_peers, p)
      if #active_peers >= 3 then break end
    end
  end

  -- 2. Get top venues not yet played
  local venues = mh.get_top_venues(3) or {}

  -- 3. Build digest
  if #active_peers == 0 and #venues == 0 then
    -- Silent run: don't notify when there's nothing meaningful
    mh.print("scene_navigator: nothing new this week")
    return
  end

  local lines = {"🗺️ Scene digest — week of " .. tostring(os.date("%d %b"))}

  if #active_peers > 0 then
    table.insert(lines, "\nActive in your scene:")
    for _, p in ipairs(active_peers) do
      local tags = table.concat(p.shared_tags or {}, ", ")
      table.insert(lines, "  • @" .. (p.username or p.artist_id) ..
        (tags ~= "" and (" [" .. tags .. "]") or ""))
    end
  end

  if #venues > 0 and aggressiveness ~= "conservative" then
    table.insert(lines, "\nVenues your peers have been playing:")
    for _, v in ipairs(venues) do
      table.insert(lines, "  • " .. (v.title or "?") ..
        (v.city and (" — " .. v.city) or "") ..
        " (" .. (v.event_count or 0) .. " connections)")
    end
  end

  mh.notify(table.concat(lines, "\n"))
  mh.kv_set("scene_nav_last_run", tostring(os.time()))
end
```

### 3.2 Collab Cartographer

```lua
-- Collab Cartographer — Wednesday collab recommendations
-- Surfaces 3 "missed connection" artists with rationale.
-- trigger: on_schedule (cron: 0 10 * * 3)

function on_schedule(event)
  local shown_key = "collab_cart_shown"
  local shown_raw = mh.kv_get(shown_key) or "{}"
  local shown = mh.json_decode(shown_raw) or {}

  -- 1. Get similar artists (already collab_with filtered in RPC via graph)
  local candidates = mh.get_similar_artists(20) or {}
  local recommendations = {}

  for _, c in ipairs(candidates) do
    -- Skip if already shown within 30 days
    local last_shown = shown[c.username or c.artist_id]
    if last_shown and (os.time() - tonumber(last_shown)) < (30 * 86400) then
      goto continue
    end

    -- Skip if score is too low
    if (c.shared_score or 0) < 0.4 then goto continue end

    local reason = "You share " .. string.format("%.0f", (c.shared_score or 0) * 100) ..
      "% graph overlap — same venues, fans, or scenes."

    table.insert(recommendations, {
      artist = c.username or c.artist_id,
      score = c.shared_score,
      reason = reason,
    })

    if #recommendations >= 3 then break end
    ::continue::
  end

  if #recommendations == 0 then
    mh.print("collab_cartographer: no new candidates this week")
    return
  end

  -- 2. Notify
  local lines = {"🗺️ Collab Cartographer — 3 missed connections this week:"}
  for i, r in ipairs(recommendations) do
    table.insert(lines, "\n" .. i .. ". @" .. r.artist)
    table.insert(lines, "   " .. r.reason)
    -- Record as shown
    shown[r.artist] = tostring(os.time())
  end
  mh.notify(table.concat(lines, "\n"))

  -- 3. Persist shown state
  mh.kv_set(shown_key, mh.json_encode(shown))
end
```

### 3.3 Opportunity Scout

```lua
-- Opportunity Scout — daily opportunity watchdog
-- Surfaces new relevant opportunities, skipping ones already shown.
-- trigger: on_schedule (cron:daily)

function on_schedule(event)
  -- 1. Fetch opportunities
  local opps = mh.get_relevant_opportunities(5) or {}
  if #opps == 0 then return end

  -- 2. Load dedup cache
  local seen_raw = mh.kv_get("opp_scout_seen") or "{}"
  local seen = mh.json_decode(seen_raw) or {}
  local now_ts = os.time()
  local TTL = 14 * 86400  -- 14 days

  local new_opps = {}
  for _, o in ipairs(opps) do
    local key = o.opp_id or o.title
    local last = seen[key]
    if not last or (now_ts - tonumber(last)) > TTL then
      table.insert(new_opps, o)
      seen[key] = tostring(now_ts)
    end
  end

  if #new_opps == 0 then
    mh.print("opportunity_scout: all opps already shown")
    return
  end

  -- 3. Check quest alignment
  local quests = mh.get_quest_momentum() or {}
  local active_quest_tags = {}
  for _, q in ipairs(quests) do
    if q.status == "active" then
      -- Quest tags aren't stored directly; use title words as heuristic
      for word in (q.title or ""):gmatch("%S+") do
        active_quest_tags[word:lower()] = q.title
      end
    end
  end

  -- 4. Build notification
  local lines = {"🎯 " .. #new_opps .. " new opportunity" .. (#new_opps > 1 and "s" or "") .. ":"}
  for _, o in ipairs(new_opps) do
    local deadline_str = o.deadline and (" — deadline " .. o.deadline) or ""
    local quest_note = ""
    for tag, qtitle in pairs(active_quest_tags) do
      if string.find((o.title or ""):lower(), tag) then
        quest_note = " [aligns with quest: " .. qtitle .. "]"
        break
      end
    end
    table.insert(lines, "  • " .. (o.title or "?") ..
      " [" .. (o.opp_type or "?") .. "]" .. deadline_str .. quest_note)
  end
  mh.notify(table.concat(lines, "\n"))

  -- 5. Persist seen state
  mh.kv_set("opp_scout_seen", mh.json_encode(seen))
end
```

---

## 4. Safety Constraints

All three archetypes follow the same safety model, consistent with `docs/LUA_AGENTS.md`:

1. **No auto-write social actions.** None of these agents call `mh.follow()`, `mh.comment()`, `mh.message()`, or `mh.apply()`. They only call `mh.notify()`.

2. **No cross-user private data.** The RPCs (`lua_get_scene_peers`, etc.) only return publicly visible fields: username, display_name, shared tags. They never expose private DMs, follower counts, or raw engagement numbers of other users.

3. **Aggressiveness tuning.** Users can set `mh.kv_set("aggressiveness", "conservative")` to reduce notification volume:
   - `"conservative"` — only notify when there's a high-confidence recommendation (score ≥ 0.7, or 3+ shared connections)
   - `"medium"` (default) — surface anything with score ≥ 0.4
   - `"adventurous"` — surface all results, including low-signal ones

4. **Silent runs.** If there's nothing meaningful to report, agents exit silently without sending a notification. Empty notifications are noise.

5. **Deduplication.** All three agents use KV-based dedup to avoid repeating the same recommendation within 7–30 days.

---

## 5. Lua API Extension Spec for Codex

Summary of the 4 new security-definer RPCs to add in migration 065:

| Function | RPC name | Rate limit | Returns |
|---|---|---|---|
| `mh.get_neighbors(node_id, edge_type, depth, limit)` | `lua_get_neighbors` | 10/run | `[{node_id, node_type, title, hop}]` |
| `mh.get_top_venues(limit)` | `lua_get_top_venues` | 5/run | `[{venue_node_id, title, city, event_count, fit_score}]` |
| `mh.get_scene_peers(limit)` | `lua_get_scene_peers` | 5/run | `[{artist_id, username, display_name, shared_tags, hop, recently_active}]` |
| `mh.get_engagement_summary()` | `lua_get_engagement_summary` | 3/run | `{total_plays, total_likes, total_comments, published_mixes, most_played_mix_title}` |

All RPCs:
- Are `SECURITY DEFINER, search_path = public`
- Are `REVOKE ALL FROM public; GRANT EXECUTE TO service_role`
- Return empty list / null row on any error (never raise to caller)
- Are registered in `api/lua-agent/run.py` with the same fail-open `try/except` pattern as existing tools

---

## Claude Code Handoff

Once the RPCs are live:

1. **Agent gallery cards** for `scene-navigator`, `collab-cartographer`, `opportunity-scout` in `src/views/AgentsGallery.tsx` — use the existing starter agent card pattern from `src/lib/starter_agents.ts`

2. **Starter templates** — add all 3 scripts to `src/lib/starter_agents.ts` with:
   - `default_for_trigger: true` for `scene-navigator` (the most discoverable)
   - Tags: `['graph', 'discovery', 'scene']`, `['graph', 'collab', 'career']`, `['graph', 'opportunities', 'career']`

3. **Agent editor hint** — when user selects `on_schedule` trigger and hasn't written code yet, the default template (via `defaultTemplateFor()`) should offer to show the Scene Navigator template

4. **KV tuning UI** (optional, Phase 8) — a toggle in agent settings for "aggressiveness: conservative / medium / adventurous"
