-- Opportunity Match Agent
-- Matches artist to grants, gigs, open calls, and festivals from ai_suggestions + opportunities table.
-- Trigger: cron:hourly | event:user_request

function run(ctx)
  mh_log("opportunity_match start", ctx.profile_id)

  local profile = mixhive["db.read_one"]("profiles", { id = ctx.profile_id }):await()
  if not profile then return { status = "error", message = "profile not found",
    suggestions = {}, tasks = {}, notifications = {} } end

  -- Load artist's open availability windows to filter deadlines
  local avail = mixhive["db.rpc"]("get_artist_availability",
    { p_profile_id = ctx.profile_id }
  ):await()
  local has_open_slots = #(avail or {}) > 0

  -- Load open opportunities
  local opps = mixhive["db.read"]("opportunities", { is_active = true }, 20):await()

  if #opps == 0 then
    mh_log("no active opportunities found")
    return { status = "ok", suggestions = {}, tasks = {}, notifications = {} }
  end

  local suggestions = {}
  local count = 0

  for _, opp in ipairs(opps) do
    if count >= 8 then break end

    local avail_note = has_open_slots and "has open availability slots" or "availability not set"

    local rationale_prompt = string.format([[
In 1 sentence, explain why "%s" (genres: %s, location: %s, %s) fits this opportunity:
"%s" — %s
Be specific. Max 20 words.
]],
      profile.display_name or "this artist",
      table.concat(profile.genres or {}, ", "),
      profile.location or "Belgium",
      avail_note,
      opp.title or "opportunity",
      (opp.description or ""):sub(1, 150)
    )

    local rationale = mixhive["llm.call"](rationale_prompt, "haiku"):await()

    table.insert(suggestions, suggestion(
      "opportunity_match",
      {
        opportunity_id = opp.id,
        title          = opp.title,
        opp_type       = opp.opp_type,
        city           = opp.city,
        compensation   = opp.compensation,
        deadline       = opp.deadline,
        source_url     = opp.source_url,
      },
      0.70,
      rationale,
      false
    ))
    count = count + 1
  end

  local notifications = {}
  if #suggestions > 0 then
    table.insert(notifications, notify(
      #suggestions .. " opportunities matched",
      "New gigs, grants, and open calls matched to your profile.",
      "in_app",
      "/agents/inbox"
    ))
  end

  -- Web3 branch: propose gig proof if recent performed_at edge exists with no proof collection
  local gig_edges = mixhive["db.read"]("mythic_edges", {
    from_node_id = ctx.profile_id, edge_type = "performed_at"
  }, 3):await() or {}
  if #gig_edges > 0 then
    local existing_proofs = mixhive["db.read"]("nft_collections", {
      owner_id = ctx.profile_id, soulbound = true
    }, 1):await() or {}
    if #existing_proofs == 0 then
      local event_node_id = gig_edges[1] and gig_edges[1].to_node_id or nil
      if event_node_id then
        table.insert(suggestions, suggestion(
          "web3_proposal",
          {
            action = "check_gig_proof",
            source_type = "event",
            source_id = event_node_id,
            reason_template = "You've performed recently — mint a permanent on-chain gig proof.",
            context_stats = {}
          },
          0.75,
          "Recent gig logged with no on-chain participation proof",
          true
        ))
      end
    end
  end

  mh_log("done — " .. #suggestions .. " matches")
  return {
    status        = "ok",
    suggestions   = suggestions,
    tasks         = {},
    notifications = notifications,
  }
end
