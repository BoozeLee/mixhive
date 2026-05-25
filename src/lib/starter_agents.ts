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
mh.notify("scheduled tick at " .. os.date())
`
  }
  if (trigger === 'manual') {
    return `-- Manual agents only run from the Test button or from another agent.
mh.notify("hello from " .. mh.agent_id)
`
  }
  return `-- Triggered by ${trigger}. Customize me!
function ${trigger}(event)
  mh.notify("${trigger} fired")
end
`
}
