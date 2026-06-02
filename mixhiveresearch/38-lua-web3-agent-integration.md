# Doc 38: Lua Agent Web3 Integration

> **Phase 9 — Blockchain Integration & Experiments**
>
> This document specifies how MIXHIVE's Lua discovery agents read blockchain
> state and propose on-chain actions. It is the missing piece between the
> agent runtime (docs 25/31) and the blockchain feature experiments (doc 37).
>
> **Does NOT duplicate:** doc 25 (agent archetypes, pseudo-Lua patterns,
> `mh.*` API surface), doc 31 (durable state persistence, `agent_state_*`
> tables), doc 37 (experiment specs, success metrics, kill-switch procedures).

---

## 1. Web3 Read APIs for Lua Agents

Four new `mh.*` functions expose on-chain state to agents. All are read-only
wrappers around security-definer SQL RPCs. No agent can write on-chain state
or initiate transactions directly.

### 1.1 `mh.web3_get_pass_count(mix_id: string) → int`

Returns the total number of minted tokens across all `nft_collections` where
`source_type = 'mix'` and `source_id = mix_id`.

**SQL backing RPC:**
```sql
create or replace function public.agent_web3_get_pass_count(p_mix_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(token_count), 0)::int
  from (
    select count(t.id) as token_count
    from public.nft_collections c
    join public.nft_tokens t on t.collection_id = c.id
    where c.source_type = 'mix'
      and c.source_id = p_mix_id
      and c.status = 'live'
      and t.status = 'confirmed'
  ) sub;
$$;

grant execute on function public.agent_web3_get_pass_count(uuid) to authenticated;
```

**Fail-open:** returns `0` on any error (RPC unavailable, null mix_id).

---

### 1.2 `mh.web3_get_quest_backers(quest_id: string) → int`

Returns the count of confirmed token holders for the quest's backing
collection (`source_type = 'quest'`, `source_id = quest_id`).

**SQL backing RPC:**
```sql
create or replace function public.agent_web3_get_quest_backers(p_quest_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(count(t.id), 0)::int
  from public.nft_collections c
  join public.nft_tokens t on t.collection_id = c.id
  where c.source_type = 'quest'
    and c.source_id = p_quest_id
    and c.status = 'live'
    and t.status = 'confirmed';
$$;

grant execute on function public.agent_web3_get_quest_backers(uuid) to authenticated;
```

---

### 1.3 `mh.web3_get_supporter_history(limit: int) → [{collection_id, source_type, source_id, minted_at, holder_count}]`

Returns the creator's own collection history, most recent first. Used by
agents to check whether a creator has prior experience with passes before
proposing a new one.

**SQL backing RPC:**
```sql
create or replace function public.agent_web3_get_supporter_history(
  p_owner_id uuid,
  p_limit    int default 10
)
returns table (
  collection_id uuid,
  source_type   text,
  source_id     uuid,
  minted_at     timestamptz,
  holder_count  int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id              as collection_id,
    c.source_type,
    c.source_id,
    c.created_at      as minted_at,
    count(t.id)::int  as holder_count
  from public.nft_collections c
  left join public.nft_tokens t on t.collection_id = c.id and t.status = 'confirmed'
  where c.owner_id = p_owner_id
    and c.status in ('live', 'paused')
  group by c.id
  order by c.created_at desc
  limit p_limit;
$$;

grant execute on function public.agent_web3_get_supporter_history(uuid, int) to authenticated;
```

---

### 1.4 `mh.web3_has_gig_proof(profile_id: string) → bool`

Returns `true` if the given profile holds at least one confirmed soulbound
gig-proof token (any collection with `props->>'soulbound' = 'true'` and
`source_type = 'gig'`).

**SQL backing RPC:**
```sql
create or replace function public.agent_web3_has_gig_proof(p_profile_id uuid)
returns bool
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.nft_tokens t
    join public.nft_collections c on c.id = t.collection_id
    where t.holder_profile_id = p_profile_id
      and t.status = 'confirmed'
      and c.source_type = 'gig'
      and (c.props->>'soulbound')::bool = true
  );
$$;

grant execute on function public.agent_web3_has_gig_proof(uuid) to authenticated;
```

---

### 1.5 API availability guard

All four functions are wrapped in `run.py` with a guard that checks the
`web3_experiments_enabled` KV flag before executing any RPC. If the flag
is absent or `"false"`, the function returns the appropriate zero/null
value immediately without making a DB round-trip:

```python
# run.py binding pattern (illustrative)
def mh_web3_get_pass_count(lua_state):
    if kv_get("web3_experiments_enabled") != "true":
        return 0
    mix_id = lua_state.get("mix_id")
    result = supabase.rpc("agent_web3_get_pass_count", {"p_mix_id": mix_id}).execute()
    return result.data or 0
```

---

## 2. Web3 Proposal Pattern

Agents never initiate on-chain transactions. Instead, they insert rows into
`ai_suggestions` of `suggestion_type = 'web3_proposal'`. These surface in the
Agent Inbox and trigger a pre-populated UI flow.

### 2.1 Payload shape

```typescript
type Web3ProposalPayload = {
  action: 'create_pass' | 'open_quest_backing' | 'check_gig_proof';
  source_type: 'mix' | 'quest' | 'gig';
  source_id: string;           // UUID of the mix/quest/gig-event
  reason_template: string;     // Human-readable copy with {placeholders}
  estimated_supply?: number;   // Suggested max_supply for the collection
  context_stats: Record<string, number | string>; // Stats used in reason_template
};
```

**Example row in `ai_suggestions`:**
```json
{
  "suggestion_type": "web3_proposal",
  "approval_policy": "on_action",
  "payload": {
    "action": "create_pass",
    "source_type": "mix",
    "source_id": "9f3a1c2d-...",
    "reason_template": "Your mix has {play_count} plays and no supporter pass yet. Opening 50 passes could convert engaged listeners to backers.",
    "estimated_supply": 50,
    "context_stats": { "play_count": 412, "unique_listeners": 87 }
  }
}
```

### 2.2 On-accept behavior

When a user taps "Accept" on a `web3_proposal` inbox card:
1. Frontend reads `payload.action` to determine which modal to open:
   - `create_pass` → opens `NftMintModal` pre-populated with `source_type`, `source_id`, `estimated_supply`
   - `open_quest_backing` → opens `NftQuestBackingModal` pre-populated with `source_id`
   - `check_gig_proof` → opens `GigProofStatusModal` showing pending/claimed state
2. The `ai_suggestions` row is updated to `status = 'accepted'`
3. `experiment_events` row inserted: `{ event_type: 'web3_proposal_accepted', payload: { agent_id, action, source_type, source_id } }`

### 2.3 On-dismiss behavior

When a user taps "Dismiss" on the inbox card:
1. `ai_suggestions` row updated to `status = 'dismissed'`
2. `experiment_events` row inserted: `{ event_type: 'web3_proposal_dismissed', ... }`
3. Agent checks `agent_events` table before re-proposing the same `(agent_id, source_id, action)` tuple — minimum 30-day silence window (see §5)

---

## 3. Per-Agent Web3 Behaviors

### 3.1 Scene Navigator (weekly `on_schedule`)

**Trigger condition:** After scoring the creator's mixes, if:
- Top mix has `play_count > 300`
- No active `nft_collections` row exists for that mix (`source_type='mix'`, `status` in `['live','deploying']`)
- No `web3_proposal` for the same `(agent_id='scene_navigator', source_id=mix_id, action='create_pass')` in the last 30 days

**Action:** Insert `ai_suggestions` row with `action='create_pass'`, `estimated_supply=50`.

**Why 50?** Keeps supply scarce enough to feel meaningful without excluding most fans. The creator can adjust in `NftMintModal` before deploying.

---

### 3.2 Collab Cartographer (weekly `on_schedule`)

**Trigger condition:** For each active quest the creator owns:
- Quest has `≥ 5` followers who have a `follows` edge to the creator but have never backed the quest (no `backed_quest` edge in `mythic_edges`)
- No active collection for that quest yet
- No `web3_proposal` for the same `(agent_id='collab_cartographer', source_id=quest_id, action='open_quest_backing')` in the last 30 days

**Action:** Insert `ai_suggestions` row with `action='open_quest_backing'`, `context_stats.engaged_followers` = count found above.

---

### 3.3 Opportunity Scout (daily `on_schedule`)

**Trigger condition:** Creator has a `performed_at` MythicNode edge created in the last 7 days AND:
- No confirmed gig-proof collection for that gig event yet
- Creator has `profiles.wallet_address` set (i.e. wallet connected — Tier 1 minimum required)
- No `web3_proposal` for the same `(agent_id='opportunity_scout', source_id=gig_event_id, action='check_gig_proof')` in the last 30 days

**Action:** Insert `ai_suggestions` row with `action='check_gig_proof'`, `reason_template` explaining that a gig-proof can be issued to confirmed attendees.

**Note:** Opportunity Scout does NOT mint on behalf of anyone. The proposal only surfaces the option; the creator decides whether to issue proofs to attendees.

---

## 4. Full Pseudo-Lua Script — Scene Navigator Web3 Branch

This extends the Scene Navigator script from doc 25. The web3 branch runs
after the existing scene-discovery logic, reusing the `top_mix_id` and
`top_mix_plays` values already stored in the agent's KV during that run.

```lua
-- Scene Navigator — web3 branch (runs after existing discovery logic)

-- Guard: only run if web3 experiments are enabled
local flag = mh.kv_get("web3_experiments_enabled") or "false"
if flag ~= "true" then
  return  -- skip entire web3 branch silently
end

local play_count = tonumber(mh.kv_get("top_mix_plays") or "0")
local mix_id = mh.kv_get("top_mix_id")

if not mix_id or play_count <= 300 then
  return  -- threshold not met; no proposal
end

-- Check if a live/deploying collection already exists for this mix
local pass_count = mh.web3_get_pass_count(mix_id)
if pass_count > 0 then
  return  -- collection already active; nothing to propose
end

-- Check 30-day silence window via agent_events
local last_proposal = mh.agent_event_last(
  "scene_navigator",
  "web3_proposal_sent",
  mix_id
)
if last_proposal and last_proposal.days_ago < 30 then
  return  -- proposed recently; respect cooldown
end

-- Check for existing dismissed proposal within 30 days
local last_dismissed = mh.agent_event_last(
  "scene_navigator",
  "web3_proposal_dismissed",
  mix_id
)
if last_dismissed and last_dismissed.days_ago < 30 then
  return  -- user dismissed recently; don't re-nag
end

-- All conditions met — insert proposal
mh.suggest({
  suggestion_type = "web3_proposal",
  approval_policy = "on_action",
  payload = {
    action           = "create_pass",
    source_type      = "mix",
    source_id        = mix_id,
    reason_template  = "Your mix has {play_count} plays and no supporter pass yet. "
                    .. "Opening {estimated_supply} passes could convert engaged listeners into backers.",
    estimated_supply = 50,
    context_stats    = {
      play_count = play_count,
    },
  },
})

-- Record that we sent this proposal (prevents re-send within 30 days)
mh.agent_event_log("scene_navigator", "web3_proposal_sent", mix_id)
```

### 4.1 `mh.agent_event_last` and `mh.agent_event_log`

These are thin wrappers over the `agent_events` table (doc 31). They are not
new functions — `agent_event_log` maps to an `INSERT` into `agent_events` with
`event_type` set appropriately, and `agent_event_last` queries
`agent_events WHERE agent_id = X AND event_type = Y AND payload->>'source_id' = Z`
ordered by `created_at DESC LIMIT 1`, returning `{ days_ago: int }`.

Both are available in `run.py` as `mh.agent_event_log` and
`mh.agent_event_last` per the agent runtime already specified in doc 31.

---

## 5. Guardrails

### 5.1 Global experiment flag check

Every web3 branch in every agent MUST check the KV flag first:

```lua
local flag = mh.kv_get("web3_experiments_enabled") or "false"
if flag ~= "true" then return end
```

This KV key mirrors the server-side `WEB3_EXPERIMENTS_ENABLED` env var. The
`run.py` startup syncs the env var value into the KV store so Lua can read it
without an additional RPC:

```python
# run.py init (pseudocode)
import os
kv_set("web3_experiments_enabled",
       os.environ.get("WEB3_EXPERIMENTS_ENABLED", "false"))
```

### 5.2 30-day re-propose cooldown

Before inserting any `web3_proposal`, the agent MUST verify that no proposal
of the same `(agent_id, source_id, action)` was logged in the last 30 days,
using `agent_events` as the record of truth. The check covers both sent
proposals AND dismissed proposals — if the user dismissed, the agent waits
the full 30 days before trying again.

### 5.3 Proposals are always `on_action`

All `web3_proposal` suggestions use `approval_policy = 'on_action'`. They are
never auto-executed. No agent may set `approval_policy = 'auto'` for any
web3 action.

### 5.4 Max 1 active web3 proposal per user per agent run

Each agent run MAY insert at most 1 `web3_proposal` per invocation. If
multiple mixes or quests qualify simultaneously, the agent selects the
single best candidate (highest `play_count` or `engaged_followers`) and
proposes only that one. This prevents inbox flooding.

### 5.5 Wallet requirement check

For `create_pass` and `open_quest_backing` proposals, the agent SHOULD only
propose if `profiles.wallet_address IS NOT NULL` for the owner (i.e., wallet
is connected at Tier 1+). Proposing to a user with no wallet creates a dead
end in the UI — the `NftMintModal` requires wallet connection.

For `check_gig_proof`, the wallet requirement is on the attendees, not the
creator — this proposal may be made to any creator who has a recent `performed_at`
edge, regardless of their own wallet state.

---

## 6. Evaluation and Feedback Loop

### 6.1 Metrics tracked

After each 4-week experiment window, the following are computed per agent:

| Metric | Source | Target |
|---|---|---|
| Proposal acceptance rate | `experiment_events` where `event_type='web3_proposal_accepted'` / total sent | ≥ 15% |
| Proposal dismissal rate | `experiment_events` where `event_type='web3_proposal_dismissed'` / total sent | ≤ 60% |
| Conversion rate (proposal → collection live) | `nft_collections.status='live'` created within 7 days of accepted proposal | ≥ 50% of accepted |
| False-positive rate | proposals accepted but collection never deployed | ≤ 25% of accepted |

### 6.2 Threshold adjustment via KV flags

If acceptance rate < 5% after 4 weeks, the play-count threshold for Scene
Navigator proposals is raised by adjusting a KV flag:

```lua
-- Agent reads dynamic threshold instead of hardcoded 300
local play_threshold = tonumber(mh.kv_get("web3_pass_play_threshold") or "300")
if play_count <= play_threshold then return end
```

An admin can set `web3_pass_play_threshold` to `500` or `1000` via the admin
panel KV editor without a code deploy. This makes the proposal more selective
until acceptance rates recover.

Similarly, the Collab Cartographer threshold (`web3_quest_follower_threshold`,
default `5`) and Opportunity Scout's gig recency window
(`web3_gig_proof_days`, default `7`) are both KV-adjustable.

### 6.3 Feedback after agent gallery redesign (future)

Once the Agent Gallery (doc 29) surfaces per-agent acceptance rates in the
admin view, the threshold KVs can be auto-tuned nightly by a lightweight
`on_schedule` tuner agent that reads `experiment_events` aggregates and
adjusts the thresholds within predefined bounds. This is Phase 10+ work and
is NOT part of Phase 9.

---

## 7. Codex & Claude Code Handoffs

**Codex handoff (Phase 9 implementation):**
- 4 new security-definer RPCs in a migration:
  - `agent_web3_get_pass_count(p_mix_id uuid) → int`
  - `agent_web3_get_quest_backers(p_quest_id uuid) → int`
  - `agent_web3_get_supporter_history(p_owner_id uuid, p_limit int) → table`
  - `agent_web3_has_gig_proof(p_profile_id uuid) → bool`
- Wire all four into `run.py` as `mh.web3_*` functions with the KV guard
- Add `mh.agent_event_last` wrapper function to `run.py` (reads `agent_events`)
- Sync `WEB3_EXPERIMENTS_ENABLED` → KV store in `run.py` startup

**Claude Code handoff:**
- Agent Inbox card component: add case for `suggestion_type === 'web3_proposal'` rendering a card with action-specific icon (pass icon for `create_pass`, quest icon for `open_quest_backing`, gig icon for `check_gig_proof`), interpolated `reason_template` text, and "Open" / "Dismiss" buttons
- `NftMintModal`: accept optional `proposal?: Web3ProposalPayload` prop; when provided, pre-populate `source_type`, `source_id`, and `max_supply` fields and skip the source-selection step
- On "Accept" tap: call `supabase.from('ai_suggestions').update({ status: 'accepted' })` then fire `trackEvent('web3_proposal_accepted', { agent_id, action, source_type, source_id })`
- On "Dismiss" tap: call update `status = 'dismissed'` then fire `trackEvent('web3_proposal_dismissed', ...)`

---

*Resolves: Phase 9 doc 38 — Lua agent web3 read APIs, proposal pattern, per-agent behaviors, guardrails, evaluation loop*
