# Social Feature Experiment Metrics & A/B Design (Phase 7)

**"Build the measurement system before you build the features that need measuring."**

**Status:** Spec — ready for Codex (experiment_events table) and analysis team  
**Date:** 31 May 2026  
**Extends:** `18-mythic-metrics-dashboard-spec.md` (dashboard UI) · `20-mythic-differentiation-experiments.md` (5 experiment outlines)  
**This doc adds:** A/B testing methodology, event tracking schema, analysis approach

---

## 1. Core Metrics Taxonomy

### Tier 1 — Platform Health (north star)

These are calculated from existing tables. No new instrumentation needed.

| Metric | Source | Calculation |
|---|---|---|
| DAU | `profiles.updated_at` | Distinct profile IDs active in last 24h |
| MAU | `profiles.updated_at` | Distinct profile IDs active in last 30d |
| DAU/MAU ratio | Derived | DAU ÷ MAU; target ≥ 0.15 for underground niche |
| Session length | `notifications + feed` events | Median time between first and last event per day per user |
| Sessions/user/week | `experiment_events` | Distinct session start events per user per 7d window |

### Tier 2 — Social Graph Depth

These proxy for whether the MythicNode graph is growing and becoming useful.

| Metric | Source | Calculation |
|---|---|---|
| Avg followers per active user | `follows` table | mean(follower_count) WHERE active in last 30d |
| Avg collab_with edges per user | `mythic_edges` | mean(count) WHERE edge_type='collab_with' per artist node |
| Avg graph degree | `mythic_edges` | mean(outbound + inbound edges per node) |
| % users with ≥1 performed_at edge | `mythic_edges` | count(distinct owner_id) / total active users |
| Scene cluster connectedness | `mythic_edges` | Avg k=2 reachable artists per user (via similar_artist) |

### Tier 3 — Agent Adoption

These tell us whether agents are providing value, not just running.

| Metric | Source | Calculation |
|---|---|---|
| Agents enabled per active user | `lua_agents` | mean(count per user) WHERE active in last 30d |
| Recommendation view rate | `experiment_events` | agent_recommendation_viewed / agent_run_completed |
| Recommendation acceptance rate | `experiment_events` | agent_recommendation_accepted / agent_recommendation_viewed |
| Quest activation rate | `experiment_events` | mythic_quest_started / active_users_30d |
| Quest completion rate | `quests` | count(status='completed') / count(status IN ('active','completed')) |
| Starter template fork rate | `lua_agents` | % of user agents forked from a starter template |

---

## 2. Per-Experiment Metrics

### Experiment 1: Mythic Co-Production Sessions (doc 22)

**Goal:** Prove that graph-attributed collab sessions increase artist engagement and graph density.

| | Metric | How to measure |
|---|---|---|
| **Primary** | Collab sessions started (per active user per week) | `experiment_events.event_type = 'collab_session_started'` |
| **Primary** | `collab_with` edges created (normalized to active users) | `mythic_edges WHERE edge_type='collab_with'` deltas per week |
| **Primary** | Mix published from session (conversion) | `experiment_events.event_type = 'mix_published_from_session'` |
| **Secondary** | Session duration | `experiment_events`: delta between `collab_session_started` and `collab_session_ended` |
| **Secondary** | Participants per session | `collab_session_participants` count per session |
| **Guardrail** | Support tickets / spam reports from session participants | Manual check; expect 0 in beta |

**Success threshold:** ≥15% of active users start at least 1 collab session within 30 days of feature launch; at least 30% of sessions result in a mix published.

---

### Experiment 2: Yield Attribution (Opportunity Attribution Loop)

**Goal:** Show that `yielded_outcome` edges provide real signal to the Yield Analyst agent.

| | Metric | How to measure |
|---|---|---|
| **Primary** | Opportunity saves with outcome recorded (rate) | `opportunity_saves WHERE outcome IS NOT NULL` / all saves |
| **Primary** | `yielded_outcome` edges created per user | `mythic_edges WHERE edge_type='yielded_outcome'` per user per month |
| **Primary** | Yield Analyst suggestions accepted | `experiment_events.event_type = 'agent_recommendation_accepted' WHERE feature='yield_analyst'` |
| **Secondary** | Time between opportunity saved → outcome recorded | Median lag in days |
| **Guardrail** | False positive outcomes (users who recorded "got booked" but then reversed) | Hard to measure; proxy by `opportunity_saves.outcome` update rate |

**Success threshold:** ≥25% of opportunity saves have an outcome recorded within 90 days; Yield Analyst acceptance rate ≥20%.

---

### Experiment 3: Opportunity Scout Agent

**Goal:** Increase opportunity application rate by surfacing relevant opportunities proactively.

| | Metric | How to measure |
|---|---|---|
| **Primary** | Opportunities viewed after agent suggestion | `experiment_events.event_type = 'opportunity_viewed' WHERE context='agent_suggestion'` |
| **Primary** | Opportunities applied after agent suggestion | `experiment_events.event_type = 'opportunity_applied' WHERE context='agent_suggestion'` |
| **Primary** | Time-to-apply uplift (treatment vs. control) | Median days from opportunity publish to first application in treatment vs. control |
| **Secondary** | Agent run retention (% of users who keep the Scout enabled after 2 weeks) | `lua_agents WHERE id='opportunity-scout' AND is_active=true` cohort retention |
| **Guardrail** | Irrelevance reports ("this wasn't relevant") | Star-rating on notification; target <10% negative feedback |

**Success threshold:** 10% absolute lift in application rate for treatment group vs. control.

---

### Experiment 4: Mythic Quest Lines

**Goal:** Show that quests increase long-term engagement and social graph activity.

| | Metric | How to measure |
|---|---|---|
| **Primary** | Quests started per active user | `experiment_events.event_type = 'mythic_quest_started'` per user in 30d window |
| **Primary** | Quest completion rate | `quests WHERE status='completed'` / (started + completed) |
| **Primary** | Milestone velocity | Mean days between consecutive milestone completions |
| **Secondary** | Feed engagement uplift for quest-active users | Likes + comments per session for users with active quests vs. without |
| **Secondary** | Social graph growth during quest | Delta in followed/collab_with edges during active quest period |
| **Guardrail** | Quest abandonment rate (started but stalled > 30 days) | `quests WHERE status='active' AND updated_at < now() - interval '30 days'` |

**Success threshold:** Quest completion rate ≥35% (industry baseline for goal-completion products: 20-30%); quest-active users show ≥20% higher session frequency.

---

### Experiment 5: Tour Weaver (Gig Logging)

**Goal:** Bootstrap the graph with high-signal performed_at edges that unlock agent quality.

| | Metric | How to measure |
|---|---|---|
| **Primary** | Gig logs created per active user (first 30 days) | `experiment_events.event_type = 'gig_log_created'` per user |
| **Primary** | `performed_at` edges per user | `mythic_edges WHERE edge_type='performed_at'` per artist node |
| **Primary** | Feed engagement uplift after first gig log | DAU-normalized likes/comments for users before vs. after first gig log |
| **Secondary** | GraphSeedingModal completion rate | `experiment_events.event_type = 'graph_seeding_completed'` / modal_opened |
| **Secondary** | Agent suggestion quality improvement after graph seeding | Yield Analyst acceptance rate for users with ≥3 gig logs vs. 0 |
| **Guardrail** | Duplicate/fake venue nodes created | Manual spot-check; deduplicated by name+city in the RPC |

**Success threshold:** ≥40% of new users log at least 1 gig within 14 days of activation; users with ≥3 gig logs show ≥30% higher 30-day retention.

---

## 3. A/B Testing Framework

### Assignment strategy

Use deterministic `profile_id % N` assignment — no external experimentation platform needed, no cookies, no tracking pixels.

```sql
-- Treatment group: users where profile_id hashmod = 0 (50% split)
-- Assign at feature flag read time, not at experiment start
SELECT (
  ('x' || substr(profile_id::text, 1, 8))::bit(32)::int & 2147483647
) % 2 = 0 AS in_treatment
FROM profiles WHERE id = $profile_id;
```

For each experiment, store the assignment in `experiment_events`:

```sql
INSERT INTO experiment_events (profile_id, event_type, feature, variant, properties, created_at)
VALUES ($uid, 'experiment_assigned', 'tour_weaver', 'treatment', '{}', now());
```

### Experiment duration and sample size

| Experiment | Min duration | Target N per group | Primary metric MDE |
|---|---|---|---|
| 1 – Co-Production Sessions | 4 weeks | 200 | 15% lift in session start rate |
| 2 – Yield Attribution | 8 weeks | 300 | 25% lift in outcome recording rate |
| 3 – Opportunity Scout | 2 weeks | 500 | 10% lift in application rate |
| 4 – Mythic Quest Lines | 4 weeks | 300 | 20% lift in session frequency |
| 5 – Tour Weaver | 2 weeks | 400 | 40% of new users log ≥1 gig |

MDE (Minimum Detectable Effect) at 80% power, α=0.05 — calculated assuming binary outcomes with baseline p=0.20 unless noted.

### Stopping rules

- **Early stop for harm:** If the guardrail metric degrades by >20% relative to baseline in treatment, pause the experiment immediately.
- **Early stop for success:** If the primary metric shows p<0.01 AND effect size exceeds 2× MDE, call the experiment early.
- **No peeking:** Commit to a pre-registered analysis date to avoid false positives from repeated testing.

---

## 4. Event Tracking Schema

### `experiment_events` table (new, migration 065)

```sql
CREATE TABLE IF NOT EXISTS public.experiment_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type   text NOT NULL,
  feature      text,               -- experiment name, e.g. 'tour_weaver'
  variant      text,               -- 'control' | 'treatment'
  properties   jsonb DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON experiment_events (feature, variant, created_at);
CREATE INDEX ON experiment_events (profile_id, event_type, created_at);
```

**RLS:** Users can read their own rows. Insert is via service_role only (API routes, agents). No public insert.

### Required event types (12)

| Event type | Fired from | Key properties |
|---|---|---|
| `experiment_assigned` | Feature flag read | `{feature, variant}` |
| `agent_run_completed` | AgentRunner.ts | `{agent_id, trigger, status, duration_ms}` |
| `agent_recommendation_viewed` | React notification component | `{agent_id, recommendation_type, target_id}` |
| `agent_recommendation_accepted` | User action handler | `{agent_id, recommendation_type, target_id}` |
| `agent_recommendation_dismissed` | User action handler | `{agent_id, recommendation_type, target_id}` |
| `mythic_quest_started` | `POST /api/quests` | `{quest_id, source}` (source: user_created \| agent_proposed) |
| `quest_milestone_completed` | `POST /api/quests/{id}/milestones/{mid}/complete` | `{quest_id, milestone_id, days_since_start}` |
| `quest_completed` | Quest status update | `{quest_id, total_days, milestones_completed}` |
| `gig_log_created` | Tour Weaver API | `{event_node_id, venue_node_id, is_first_gig_log}` |
| `graph_seeding_completed` | GraphSeedingModal | `{gigs_imported, venues_created, edges_created}` |
| `collab_session_started` | `POST /api/mythic/sessions` | `{session_id, participant_count}` |
| `mix_published_from_session` | Mix publish + session link | `{mix_id, session_id, session_duration_minutes}` |
| `opportunity_viewed` | Opportunity list click | `{opportunity_id, context}` (context: feed \| agent_suggestion \| direct) |
| `opportunity_applied` | Opportunity apply action | `{opportunity_id, context, time_since_opp_published_hours}` |

---

## 5. Analysis Approach

### Binary outcomes (e.g. quest started Y/N, gig log created Y/N)

Use chi-squared test with 2×2 contingency table (control/treatment × outcome/no-outcome).

```python
from scipy.stats import chi2_contingency
# contingency = [[control_yes, control_no], [treatment_yes, treatment_no]]
chi2, p, dof, expected = chi2_contingency(contingency)
```

Report: chi2 statistic, p-value, relative lift = (treatment_rate - control_rate) / control_rate.

### Continuous outcomes (e.g. session length, time-to-apply)

Use Welch's t-test (unequal variances). Log-transform right-skewed distributions (session length, play counts) before testing.

```python
from scipy.stats import ttest_ind
t, p = ttest_ind(treatment_values, control_values, equal_var=False)
```

### Rollout analysis (ITS — Interrupted Time Series)

For always-on features rolled out to 100% of users (no control group), use ITS:

```
y_t = α + β₁t + β₂D_t + β₃(t × D_t) + ε_t
```

Where `D_t = 1` after the launch date. `β₂` is the level change, `β₃` is the slope change. Use OLS on weekly aggregated metric values over a 12-week window (6 pre, 6 post).

### Cohort analysis

For retention experiments: bucket users by activation week, measure the metric at weeks 1, 2, 4, 8 for each cohort. Plot cohort curves. Identify if the feature cohort's curve is higher than the pre-feature baseline cohort.

---

## 6. Instrumentation Hooks

### Where to fire events in the codebase

All event inserts use the fire-and-forget pattern — never `await` an experiment event insert inside a user-facing request handler:

```typescript
// Pattern: fire-and-forget, never throws
void supabase.from('experiment_events').insert({
  profile_id: userId,
  event_type: 'gig_log_created',
  feature: 'tour_weaver',
  variant: getUserVariant(userId, 'tour_weaver'),  // profile_id % 2
  properties: { event_node_id, venue_node_id, is_first_gig_log },
}).then(() => {}).catch(() => {});
```

Key instrumentation points:

| File | Event to fire |
|---|---|
| `src/app/api/quests/route.ts` (POST) | `mythic_quest_started` |
| `src/app/api/quests/[id]/milestones/[mid]/complete/route.ts` | `quest_milestone_completed` |
| `src/server/lua-agents/AgentRunner.ts` (after run) | `agent_run_completed` |
| `src/components/AgentSuggestionCard.tsx` (view) | `agent_recommendation_viewed` |
| `src/components/AgentSuggestionCard.tsx` (accept) | `agent_recommendation_accepted` |
| `src/app/api/mythic/sessions/route.ts` (POST) | `collab_session_started` |
| Tour Weaver gig log API route (new, Phase 8) | `gig_log_created` |
| `src/components/GraphSeedingModal.tsx` (submit) | `graph_seeding_completed` |

### `getUserVariant` helper

```typescript
// src/lib/experiments.ts
export function getUserVariant(profileId: string, feature: string): 'control' | 'treatment' {
  const hash = profileId.replace(/-/g, '').slice(0, 8);
  const bucket = parseInt(hash, 16) % 2;
  return bucket === 0 ? 'treatment' : 'control';
}
```

This is deterministic — the same user always gets the same variant for a given feature.

---

## Codex Handoff

**Migration 065** — `experiment_events` table + RLS + 2 indexes (see section 4).

**No external analytics vendor needed.** All queries run directly against `experiment_events` in Supabase. For dashboards, use the existing `18-mythic-metrics-dashboard-spec.md` pattern (Supabase PostgREST or direct SQL in admin routes).
