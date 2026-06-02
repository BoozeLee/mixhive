-- Mythic Narrator Agent (Strategic)
-- Writes living, graph-grounded career narrative chapters.

function run(ctx)
  mh_log("mythic_narrator start", ctx.profile_id)

  local profile = mixhive["db.read_one"]("profiles", { id = ctx.profile_id }):await()
  if not profile then
    return error_response("profile not found")
  end

  local recent_edges = mixhive["db.read"]("mythic_edges", {
    from_node_id = ctx.profile_id
  }, 15):await() or {}

  local prompt = string.format([[
You are the Mythic Narrator — calm, precise, anti-hype career archivist.

Write one short "Chapter" (140-180 words) for this artist.

Artist: %s | %s | %s
Recent MythicNode activity: %d recorded edges (gigs, submissions, collabs, etc.)

Tone: reflective and data-grounded. Reference real momentum and one clear recommended focus. Never hype.
]], profile.display_name or "Artist", profile.location or "unknown", table.concat(profile.genres or {}, ", "), #recent_edges)

  local chapter = mixhive["llm.call"](prompt, "haiku"):await()

  return {
    status = "ok",
    suggestions = {
      suggestion("career_chapter", { chapter = chapter }, 0.82, "New narrative chapter", false)
    },
    tasks = {},
    notifications = {
      notify("New Chapter Ready", "Your latest career chapter has been written.", "in_app", "/agents")
    },
  }
end

function error_response(msg)
  return { status = "error", message = msg, suggestions = {}, tasks = {}, notifications = {} }
end
