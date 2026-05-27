// Built-in Lua agent templates shipped with the app.
//
// Used by two surfaces:
//   1. /agents/gallery — always renders these as "Starter library" cards
//      so a brand-new install has something to fork on day one (the
//      lua_agents table starts empty, the public-agents query returns
//      [], and the gallery would otherwise feel dead).
//   2. /agents editor — the per-trigger "blank starter" code shown when
//      the user picks a trigger but hasn't written any Lua yet.
//
// Both surfaces share this module to keep the source of truth in one
// place. To add a new template, drop another entry below and mark its
// `default_for_trigger: true` if you want it to be the auto-suggested
// blank starter for that trigger.

import type { LuaAgentTrigger } from './agents'

export interface StarterAgent {
  /** Stable slug; used as the React key in the gallery and the deep-link target. */
  id: string
  name: string
  description: string
  trigger_type: LuaAgentTrigger
  /** 5-field cron, only meaningful when trigger_type === 'on_schedule'. */
  cron_expr?: string
  tags: string[]
  lua_code: string
  /** When true, this template is auto-suggested in the editor for `trigger_type`. */
  default_for_trigger?: boolean
}

export const STARTER_AGENTS: StarterAgent[] = [
  {
    id: 'welcome-new-followers',
    name: 'Welcome new followers',
    description: 'Notify yourself when someone follows you, and (optionally) drop a friendly hello on their most recent mix.',
    trigger_type: 'on_follow',
    tags: ['social', 'growth'],
    default_for_trigger: true,
    lua_code: `-- Welcome new followers.
-- Fires every time someone follows you.

function on_follow(event)
  local actor = mh.get_profile(event.actor_id)
  if not actor then return end

  mh.notify("👋 New follower: @" .. actor.username)

  -- Optional: drop a hello on their most recent mix. Uncomment to enable.
  -- local mixes = mh.fetch_recent_mixes(50)
  -- for _, m in ipairs(mixes) do
  --   if m.dj_id == actor.id then
  --     mh.comment(m.id, "Thanks for the follow — looking forward to your sets!")
  --     break
  --   end
  -- end
end
`,
  },

  {
    id: 'thank-every-commenter',
    name: 'Thank every commenter',
    description: 'Reply once to anyone who comments on your mix (skips your own replies).',
    trigger_type: 'on_comment',
    tags: ['social', 'engagement'],
    default_for_trigger: true,
    lua_code: `-- Thank every commenter — except yourself.

function on_comment(event)
  if event.actor_id == mh.owner_id then return end

  local actor = mh.get_profile(event.actor_id)
  local handle = actor and actor.username or "friend"
  mh.comment(event.mix_id, "Thanks for the feedback, @" .. handle .. "!")
end
`,
  },

  {
    id: 'daily-new-releases-digest',
    name: 'Daily releases digest',
    description: 'Every morning at 09:00 UTC, summarise the freshest mixes platform-wide so you can hand-pick what to listen to.',
    trigger_type: 'on_schedule',
    cron_expr: '0 9 * * *',
    tags: ['discovery', 'schedule'],
    lua_code: `-- Daily digest at 09:00 UTC.
-- Picks up the 10 most recent published mixes and notifies you.

mh.print("digest tick")

local mixes = mh.fetch_recent_mixes(10) or {}
if #mixes == 0 then
  mh.notify("No new mixes overnight 🌙")
  return
end

local lines = {"📻 Top " .. #mixes .. " new mixes:"}
for i, m in ipairs(mixes) do
  table.insert(lines, i .. ". " .. m.title)
end
mh.notify(table.concat(lines, "\\n"))
`,
  },

  {
    id: 'reciprocate-likes',
    name: 'Reciprocate first like',
    description: 'When a brand-new fan likes one of your mixes, follow them back. Keep your community tight.',
    trigger_type: 'on_like',
    tags: ['social', 'reciprocity'],
    default_for_trigger: true,
    lua_code: `-- Follow back anyone who likes a mix of yours.
-- v1: triggers on EVERY like; the DB enforces uniqueness on follows so
-- repeated runs are a no-op.

function on_like(event)
  if event.actor_id == mh.owner_id then return end
  mh.follow(event.actor_id)
  mh.print("followed @" .. event.actor_id .. " after their like")
end
`,
  },

  {
    id: 'repost-reply',
    name: 'Like back on repost',
    description: 'When someone reposts you, return the love by liking their most recent mix.',
    trigger_type: 'on_repost',
    tags: ['social', 'reciprocity'],
    default_for_trigger: true,
    lua_code: `-- When someone reposts a mix of yours, like their newest mix back.

function on_repost(event)
  local reposter = mh.get_profile(event.actor_id)
  if not reposter then return end

  for _, m in ipairs(mh.fetch_recent_mixes(50) or {}) do
    if m.dj_id == reposter.id then
      mh.like(m.id)
      mh.print("liked " .. m.title .. " back")
      return
    end
  end
end
`,
  },

  {
    id: 'spam-keyword-filter',
    name: 'Spam keyword filter',
    description: 'Notifies you privately whenever a comment matches a list of suspicious keywords, so you can review and delete.',
    trigger_type: 'on_comment',
    tags: ['moderation', 'safety'],
    lua_code: `-- Flag suspicious comments for human review.
-- Edit the SPAM_WORDS list to taste.

local SPAM_WORDS = {
  "buy now", "free crypto", "dm me", "telegram", "click here",
  "earn $", "make money fast", "promo code",
}

local function is_spam(body)
  body = string.lower(body or "")
  for _, word in ipairs(SPAM_WORDS) do
    if string.find(body, word, 1, true) then return word end
  end
  return nil
end

function on_comment(event)
  local hit = is_spam(event.body)
  if not hit then return end
  mh.notify("⚠️ Possible spam on mix " .. event.mix_id ..
            " — matched keyword '" .. hit .. "'. Review and delete if needed.")
end
`,
  },

  {
    id: 'welcome-once-per-follower',
    name: 'Welcome (once per follower)',
    description: 'Sends a notification when someone follows you — but only once, no matter how many times they follow/unfollow. Uses the KV store to track who has been welcomed.',
    trigger_type: 'on_follow',
    tags: ['social', 'kv', 'dedup'],
    lua_code: `-- Welcome new followers exactly once.
-- Uses mh.kv_set to remember welcomed users so repeat follows are silently skipped.

function on_follow(event)
  local key = "welcomed:" .. event.actor_id
  if mh.kv_get(key) then return end   -- already welcomed

  local actor = mh.get_profile(event.actor_id)
  local name = (actor and actor.username) or event.actor_id
  mh.notify("👋 New follower: @" .. name)
  mh.kv_set(key, "1")
end
`,
  },

  {
    id: 'reply-thank-once',
    name: 'Thank commenter (once per user per mix)',
    description: 'Auto-replies to commenters but only once per unique user per mix, so threads stay clean. Demonstrates KV-based deduplication.',
    trigger_type: 'on_comment',
    tags: ['engagement', 'kv', 'dedup'],
    default_for_trigger: false,
    lua_code: `-- Thank commenters, but at most once per (user, mix) pair.

function on_comment(event)
  if event.actor_id == mh.owner_id then return end

  local key = "thanked:" .. event.mix_id .. ":" .. event.actor_id
  if mh.kv_get(key) then return end

  local actor = mh.get_profile(event.actor_id)
  local handle = (actor and actor.username) or "friend"
  mh.comment(event.mix_id, "Thanks for listening, @" .. handle .. "! 🙌")
  mh.kv_set(key, "1")
end
`,
  },

  {
    id: 'follower-milestone',
    name: 'Follower milestone announcer',
    description: 'Tracks your total follower count in the KV store and posts a buzz when you hit a round-number milestone (100, 500, 1000…).',
    trigger_type: 'on_follow',
    tags: ['social', 'kv', 'milestones'],
    lua_code: `-- Celebrate follower milestones by posting a buzz.

local MILESTONES = {100, 250, 500, 1000, 2500, 5000, 10000}

local function is_milestone(n)
  for _, m in ipairs(MILESTONES) do
    if n == m then return true end
  end
  return false
end

function on_follow(event)
  local raw = mh.kv_get("follower_count") or "0"
  local count = tonumber(raw) + 1
  mh.kv_set("follower_count", tostring(count))

  if is_milestone(count) then
    mh.post_buzz("🎉 Just hit " .. count .. " followers on MIXHIVE — thank you all! More music incoming.")
    mh.notify("Milestone reached: " .. count .. " followers!")
  end
end
`,
  },

  {
    id: 'top-fan-tracker',
    name: 'Top fan tracker',
    description: 'Keeps a per-user like count in the KV store. When a fan hits 5 likes on your mixes, notify yourself so you can reach out.',
    trigger_type: 'on_like',
    tags: ['analytics', 'kv', 'fans'],
    lua_code: `-- Track how many times each user has liked your mixes.
-- Alert yourself when someone becomes a "top fan" (5+ likes).

local TOP_FAN_THRESHOLD = 5

function on_like(event)
  if event.actor_id == mh.owner_id then return end

  local key = "likes_from:" .. event.actor_id
  local count = tonumber(mh.kv_get(key) or "0") + 1
  mh.kv_set(key, tostring(count))

  if count == TOP_FAN_THRESHOLD then
    local fan = mh.get_profile(event.actor_id)
    local name = (fan and fan.username) or event.actor_id
    mh.notify("⭐ @" .. name .. " has liked " .. count .. " of your mixes — top fan!")
  end
end
`,
  },

  {
    id: 'weekly-stats-digest',
    name: 'Weekly stats digest',
    description: 'Every Monday at 09:00 UTC, summarise your top mixes by play count and post the list as a notification.',
    trigger_type: 'on_schedule',
    cron_expr: '0 9 * * 1',
    tags: ['analytics', 'schedule'],
    default_for_trigger: true,
    lua_code: `-- Weekly stats digest — runs every Monday at 09:00 UTC.

local function on_schedule(event)
  local mixes = mh.get_mixes_by_user(mh.owner_id, 5) or {}
  if #mixes == 0 then
    mh.notify("No published mixes yet. Upload your first set!")
    return
  end

  local lines = {"📊 Your top " .. #mixes .. " mixes this week:"}
  for i, m in ipairs(mixes) do
    table.insert(lines, i .. ". " .. m.title ..
      " — " .. (m.play_count or 0) .. " plays, " .. (m.like_count or 0) .. " likes")
  end
  mh.notify(table.concat(lines, "\\n"))
end
`,
  },

  {
    id: 'reply-notifier',
    name: 'Reply notifier',
    description: 'Notifies you when someone replies to one of your comments, with the reply body as a preview.',
    trigger_type: 'on_reply',
    tags: ['social', 'notifications'],
    default_for_trigger: true,
    lua_code: `-- Notify yourself when someone replies to your comment.

function on_reply(event)
  local actor = mh.get_profile(event.actor_id)
  local name = (actor and actor.username) or event.actor_id
  local preview = string.sub(event.body or "", 1, 80)
  mh.notify("💬 @" .. name .. " replied: \\"" .. preview .. "\\"")
end
`,
  },

  {
    id: 'spam-auto-delete',
    name: 'Spam auto-delete',
    description: 'Detects spam keywords in comments on YOUR mixes and automatically deletes the comment, then logs it.',
    trigger_type: 'on_comment',
    tags: ['moderation', 'safety'],
    lua_code: `-- Auto-delete spam comments on your mixes.
-- Edit SPAM_WORDS to taste. Comments on other people's mixes are untouched.

local SPAM_WORDS = {
  "buy now", "free crypto", "dm me", "telegram", "click here",
  "earn $", "make money fast", "promo code", "onlyfans",
}

local function is_spam(body)
  body = string.lower(body or "")
  for _, word in ipairs(SPAM_WORDS) do
    if string.find(body, word, 1, true) then return word end
  end
  return nil
end

function on_comment(event)
  local hit = is_spam(event.body)
  if not hit then return end

  local ok, err = pcall(mh.delete_comment, event.comment_id)
  if ok then
    mh.notify("🗑️ Auto-deleted spam comment on mix " .. event.mix_id ..
              " (keyword: '" .. hit .. "')")
  else
    mh.notify("⚠️ Spam detected but could not delete: " .. tostring(err))
  end
end
`,
  },

  {
    id: 'json-state-demo',
    name: 'JSON state demo',
    description: 'Demonstrates mh.json_encode / mh.json_decode by storing a structured object in the KV store across runs.',
    trigger_type: 'manual',
    tags: ['demo', 'kv', 'json'],
    lua_code: `-- JSON + KV demo: stores a structured run log.

local raw = mh.kv_get("run_log")
local log = raw and mh.json_decode(raw) or {}

table.insert(log, {run_at = tostring(os.clock()), agent = mh.agent_id})
if #log > 20 then table.remove(log, 1) end  -- keep last 20

mh.kv_set("run_log", mh.json_encode(log))
mh.print("stored " .. #log .. " run entries")
mh.notify("JSON state demo: " .. #log .. " entries in run_log KV key")
`,
  },
]

/** Default starter body for a freshly-picked trigger in the editor.
 *
 * Falls back to a one-line manual template if no starter matches.
 */
export function defaultTemplateFor(trigger: LuaAgentTrigger): string {
  const match = STARTER_AGENTS.find(s => s.trigger_type === trigger && s.default_for_trigger)
  if (match) return match.lua_code

  if (trigger === 'on_schedule') {
    return `-- Runs on a cron schedule (configure cron_expr below).
-- event.tick_at contains the UTC timestamp string.
local function on_schedule(event)
  mh.notify("scheduled tick")
end
`
  }
  if (trigger === 'manual') {
    return `-- Manual agents only run from the Test button.
mh.notify("hello from agent " .. mh.agent_id)
`
  }
  return `-- Triggered by ${trigger}. Customize me!
function ${trigger}(event)
  mh.notify("${trigger} fired")
end
`
}
