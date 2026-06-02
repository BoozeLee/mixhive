# Doc 33 — Lua Discovery Agent Metrics Framework

Phase 8 analytics spec. Extends doc 26 (product/business metrics + A/B framework).

Doc 26 covers: platform health metrics (DAU/MAU, session length), social graph depth metrics,
agent adoption metrics, per-experiment business outcomes, A/B testing methodology, and
`experiment_events` table design.

This doc covers what doc 26 does **not**: ML/recommender quality metrics for validating the
**output quality** of the three discovery agents — offline relevance metrics, diversity and
coverage metrics, guardrail metrics, and a rigorous logging spec.

---

## 1. Scope and Agent Coverage

The three discovery agents from doc 25 each produce ranked lists of recommendations:

| Agent | Recommendation type | Output K |
|---|---|---|
| **Scene Navigator** | Artists, venues, events in genre+region | 5 per weekly run |
| **Collab Cartographer** | Collaboration candidates | 3 per weekly run |
| **Opportunity Scout** | Opportunities ranked by match_score × deadline proximity | 5 per daily run |

"Quality" for a recommender has two independent dimensions:

1. **Relevance:** Did the recommended items lead to user action? (Precision@K, NDCG@K)
2. **Portfolio health:** Did the system surface enough of the catalog? Did users see diverse
   results, or were they trapped in a filter bubble? (Coverage, Diversity, Novelty)

---

## 2. Offline Metrics (Relevance & Ranking)

Offline metrics are computed after the fact, using historical data. They allow agent quality
comparison before any A/B test is run.

### 2.1 Test Set Construction

**Leave-one-period-out holdout:**

1. For each user who has at least 20 social actions (follows, opportunity applications, collab
   joins) in the last 90 days, take the **last 30 days** as the holdout period.
2. The agent is given only the **first 60 days** of history as context.
3. The agent generates its top-K recommendations using that context.
4. We compare the recommendations against the holdout period: actions taken in days 61–90.

This construction is stricter than random holdout because it mimics real deployment (agent
sees past, must predict future), and avoids data leakage from future interaction signals.

**Minimum viable test set:** 200 users with sufficient history. Below 200, run the offline
metrics but note they are indicative only.

### 2.2 Precision@K

Of the K items the agent recommended, how many did the user act on within the holdout period?

```
Precision@K = |{recommended top-K} ∩ {acted-on in holdout}| / K
```

Target values (based on comparable music discovery systems):

| Agent | Target Precision@K | K |
|---|---|---|
| Scene Navigator | ≥ 0.25 (1 in 4 surface as useful) | 5 |
| Collab Cartographer | ≥ 0.33 (1 in 3 leads to collab) | 3 |
| Opportunity Scout | ≥ 0.20 (1 in 5 leads to application) | 5 |

"Acted on" definition per agent:

- Scene Navigator: followed the artist, attended the event (gig log), or viewed the venue profile
  for > 30 seconds.
- Collab Cartographer: accepted collab invitation, started a collab session, or sent a message
  to the candidate.
- Opportunity Scout: opened the opportunity, saved it, or submitted an application.

### 2.3 Recall@K

Of all items the user eventually acted on in the holdout period, what fraction appeared in the
agent's top-K?

```
Recall@K = |{recommended top-K} ∩ {acted-on in holdout}| / |acted-on in holdout|
```

Recall matters for Collab Cartographer in particular: if the user found 6 good collabs on their
own during the holdout, but the agent only suggested 3 items and 1 overlapped, that's a recall
of 1/6 = 0.17 — the agent is missing most of the relevant items.

Target: Recall@K ≥ 0.15 for all three agents. (Low target because K is small; the goal is not
to exhaustively cover all opportunities, but to surface at least one valuable hit per run.)

### 2.4 NDCG@K (Normalized Discounted Cumulative Gain)

NDCG rewards placing the most relevant items higher in the ranked list. A recommendation at
rank 1 is worth more than one at rank 5.

```
DCG@K = Σ (rel_i / log2(i + 1)) for i = 1..K
NDCG@K = DCG@K / IDCG@K
```

Where `rel_i = 1` if item at rank i was acted on, 0 otherwise.  
`IDCG@K` = DCG of the perfect ranking (all acted-on items placed first).

Target: NDCG@K ≥ 0.30 for all three agents.

**Implementation:** A nightly Python script reads `experiment_events` + action tables
(follows, collab_session_participants, opportunity_applications), joins them against the
`agent_rec_shown` events for the same user/period, and computes these metrics per agent.
Results are written to a `agent_quality_metrics` table (append-only, one row per agent per day).

---

## 3. Diversity and Coverage Metrics

Relevance metrics alone can be gamed by always recommending the most popular items. Diversity
and coverage metrics guard against filter-bubble effects.

### 3.1 Diversity (Intra-List Diversity)

Average pairwise dissimilarity across the K items in a single recommendation list.

```
Diversity@K = (2 / K(K-1)) × Σ_{i < j} dissimilarity(item_i, item_j)
```

**Dissimilarity function (per agent):**

- Scene Navigator: `1 - genre_overlap(a, b)` where `genre_overlap` is the Jaccard similarity
  of genre tag sets. Artists with identical genre tags → dissimilarity = 0; artists with no
  shared genres → dissimilarity = 1.
- Collab Cartographer: Weighted sum: `0.5 × (1 - genre_overlap) + 0.5 × graph_distance_normalised`
  where `graph_distance_normalised = hop_count / max_depth`. Agents with identical genre and
  same graph hop → dissimilarity = 0.
- Opportunity Scout: `1 - type_match(a, b)` where type is the opportunity category
  ('booking', 'label', 'grant'). Same type → 0.5; different type → 1.0. Also weight by city
  distance if available.

**Target:** Diversity@K ≥ 0.40 (i.e. average pair of recommended items shares < 60% similarity).

### 3.2 Catalog Coverage

What fraction of the active catalog (entities created or active in the last 90 days) appears
in at least one recommendation across all users in a given week?

```
Coverage = |unique items recommended to any user this week| / |active catalog size|
```

Target: Coverage ≥ 15% of the active catalog per week per agent.

This metric detects "rich get richer" dynamics where the agent always recommends the same 10
popular artists to everyone. Low coverage is a signal to increase the `aggressiveness` KV flag
or widen the graph traversal depth.

### 3.3 Novelty

Fraction of recommendations that the user has **never interacted with before** (not followed,
not attended, not applied to).

```
Novelty@K = |{recommended top-K} \ {historically interacted}| / K
```

Target: Novelty@K ≥ 0.70 (at least 70% of recommendations are items the user hasn't seen
before). If novelty is below 0.50, the dedup logic (`rejected_ids`, `shown_to_user` in agent
state — doc 31) is not working correctly.

---

## 4. Online Metrics (Behaviour & Business Impact)

Computed from live `experiment_events` rows (schema in doc 26). These are the signals that
matter most for deployment decisions.

### 4.1 Primary Online Metrics per Agent

**Scene Navigator:**
- CTR: `agent_rec_clicked` / `agent_rec_shown` per user per week
- Follow conversion: users who followed an artist within 7 days of a `scene_navigator` shown event

**Collab Cartographer:**
- Accept rate: `agent_rec_accepted` / `agent_rec_shown`
- Collab session start rate: new `collab_sessions` rows within 72h of an accepted suggestion
- `collab_with` edges created per user per month (upstream metric; agents should accelerate this)

**Opportunity Scout:**
- Application rate: opportunity applications submitted within 7 days of `agent_rec_shown`
- Time-to-apply: median hours between `agent_rec_shown` and opportunity application (lower is better)
- Opportunity save rate: `opportunity_saves` with the agent as referrer

### 4.2 Session-Level Metrics

Do users who see agent suggestions have better sessions?

- Mix play depth: average plays-per-session for users with ≥1 agent suggestion shown vs. control
- Session length: time-on-site for treatment vs. control (from doc 26 §3)
- Bounce rate on the Quests page: lower is better if scene pulse cards are engaging

These are secondary metrics — important for detecting harm (agents damaging the core experience)
but not the primary success criteria.

---

## 5. A/B Experiment Design for Agents

### 5.1 Experimental Axes

Two axes per agent, giving a 2×2 design:

| | **Agent recommendations** | **Heuristic baseline** |
|---|---|---|
| **Conservative** (depth 2, low aggressiveness) | Bucket A | Bucket C |
| **Exploratory** (depth 3, high aggressiveness) | Bucket B | Bucket D |

**Bucket assignment:** `profile_id % 4`
- Bucket 0 → A (agent conservative)
- Bucket 1 → B (agent exploratory)
- Bucket 2 → C (heuristic baseline, conservative)
- Bucket 3 → D (heuristic baseline, exploratory)

**Heuristic baseline for each agent:**
- Scene Navigator baseline: top 5 most-followed artists in the user's declared genre, no graph traversal.
- Collab Cartographer baseline: top 3 artists with the highest mutual follower count.
- Opportunity Scout baseline: 5 most recently posted opportunities in the user's city/genre.

### 5.2 Experiment Parameters

| Parameter | Value |
|---|---|
| Minimum run duration | 2 weeks |
| Minimum detectable effect (MDE) | 10% lift on primary metric (e.g. Precision@3) |
| Required sample size | ~400 users per bucket (estimated from 80% power, α=0.05) |
| Assignment | Deterministic `profile_id % 4` — stable across sessions |
| Rollout gating | Disable experiment if any guardrail metric regresses > 5% |

### 5.3 How to Log the Variant

All `agent_rec_shown` events include the variant:

```json
{
  "event_type": "agent_rec_shown",
  "feature": "collab_cartographer",
  "variant": "agent_exploratory",
  "agent_id": "collab-cartographer",
  "rank": 1,
  "candidate_id": "node-uuid",
  "candidate_type": "artist_profile",
  "user_id": "profile-uuid",
  "timestamp": "2026-06-01T09:00:00Z"
}
```

`variant` values: `agent_conservative`, `agent_exploratory`, `heuristic_conservative`,
`heuristic_exploratory`.

The `getUserVariant` function in `src/lib/experiments.ts` (deterministic `parseInt(hash, 16) % 2`)
handles the 2-bucket case. For the 4-bucket case, use `parseInt(hash, 16) % 4` with the mapping above.

---

## 6. Guardrail Metrics

A guardrail metric regressing beyond its threshold **blocks deployment** of the agent to more
users, regardless of primary metric performance.

| Guardrail | Threshold | What it detects |
|---|---|---|
| Overall session length | Must not decrease > 5% vs. control | Agent cards are displacing engaging content |
| Feed scroll depth | Must not decrease > 5% | Agent suggestions interrupt natural feed browsing |
| Opt-out rate (dismissed all suggestions) | Must not exceed 20% of exposed users in first week | Agent is too aggressive or irrelevant |
| Mix play starts per session | Must not decrease > 5% | Agents are distracting from the core listening experience |

**Opt-out detection:** A user is counted as opted out if they fire `agent_rec_dismissed_all`
three times in a row without any `agent_rec_clicked` between them. This is logged as a single
`agent_dismissed_persistent` event and is the primary signal for over-aggressive agents.

---

## 7. Logging Requirements

Exact schema for the 5 required event types written to `experiment_events`:

```typescript
// agent_rec_shown — fires when recommendation card renders in viewport
{
  profile_id: string,         // UUID
  event_type: 'agent_rec_shown',
  feature: AgentId,           // 'scene_navigator' | 'collab_cartographer' | 'opportunity_scout'
  variant: Variant,           // 'agent_conservative' | 'agent_exploratory' | 'heuristic_*'
  properties: {
    agent_id: string,
    rank: number,             // 1-indexed position in the recommendation list
    candidate_id: string,     // UUID of the recommended mythic_node
    candidate_type: string,   // 'artist_profile' | 'venue' | 'opportunity'
    session_id?: string,      // if recommendation shown during collab session
  }
}

// agent_rec_clicked — fires on recommendation card click
{
  profile_id: string,
  event_type: 'agent_rec_clicked',
  feature: AgentId,
  variant: Variant,
  properties: {
    agent_id: string,
    candidate_id: string,
    rank: number,
  }
}

// agent_rec_accepted — fires when user takes the recommended action
{
  profile_id: string,
  event_type: 'agent_rec_accepted',
  feature: AgentId,
  variant: Variant,
  properties: {
    agent_id: string,
    candidate_id: string,
    action_type: 'follow' | 'collab_invite' | 'opportunity_apply' | 'session_start',
    rank: number,
  }
}

// agent_rec_skipped — fires when user explicitly skips/dismisses one item
{
  profile_id: string,
  event_type: 'agent_rec_skipped',
  feature: AgentId,
  variant: Variant,
  properties: {
    agent_id: string,
    candidate_id: string,
    rank: number,
  }
}

// agent_rec_dismissed_all — fires when user dismisses all recommendations in a batch
{
  profile_id: string,
  event_type: 'agent_rec_dismissed_all',
  feature: AgentId,
  variant: Variant,
  properties: {
    agent_id: string,
    session_count: number,  // consecutive dismissal count (for opt-out detection)
  }
}
```

**Where to fire events:**

In `src/components/AISuggestionCard.tsx`:
- `agent_rec_shown`: `IntersectionObserver` callback when card enters viewport
- `agent_rec_clicked`: `onClick` on the card body
- `agent_rec_accepted`: `onClick` on the primary CTA button
- `agent_rec_skipped`: `onClick` on the dismiss (×) button

Missing fields for `AISuggestionCard` (Claude Code task):
- `rank` prop (number, 1-indexed)
- `candidateId` prop (UUID string of the mythic_node being recommended)

These are passed through from the `AISuggestion` object returned by the agent. The `AISuggestion`
type in `src/lib/types.ts` should add `rank?: number` and `candidate_id?: string`.

---

## 8. Analysis Approach

### 8.1 Offline Analysis (Nightly Script)

A Python script (`scripts/eval_agent_quality.py`) runs nightly:

1. Fetch `experiment_events` of type `agent_rec_shown` for the last 30 days.
2. For each (user, agent) pair, collect the shown candidate IDs and their ranks.
3. Fetch user actions (follows, applications, collab sessions) in the same period.
4. Compute Precision@K, Recall@K, NDCG@K, Diversity@K, Novelty@K.
5. Write results to `agent_quality_metrics (agent_id, metric_name, value, computed_at)`.

### 8.2 Online Analysis

- **Binary outcomes** (accepted Y/N): chi-squared test, 2×2 contingency table (agent vs. heuristic).
- **Continuous outcomes** (CTR, session length): Mann-Whitney U test (non-parametric; distributions
  are typically skewed). Do not use t-test unless verifying normality first.
- **Always-on rollouts** (no clean control group): Interrupted Time Series (ITS) — compare
  metric trajectory before and after agent launch. Control for seasonality (day-of-week effects).

### 8.3 Reporting Cadence

| Report | Frequency | Audience |
|---|---|---|
| Offline quality metrics (Precision, NDCG) | Nightly | Engineering |
| Online A/B results (CTR, accept rate) | Weekly | Engineering + Product |
| Guardrail check | Daily (automated alert if threshold breached) | On-call engineer |
| Full experiment read-out | After minimum 2-week run | Engineering + Product |

---

## 9. Codex & Claude Code Handoff

**Codex handoff:**
- `agent_quality_metrics` table: `(id UUID PK, agent_id TEXT, metric_name TEXT, value FLOAT, bucket INT, computed_at TIMESTAMPTZ)`
- `scripts/eval_agent_quality.py` skeleton (reads from Supabase, writes to `agent_quality_metrics`)

**Claude Code handoff:**
- Add `rank?: number` and `candidate_id?: string` to `AISuggestion` type in `src/lib/types.ts`
- Update `AISuggestionCard` experiment tracking calls to pass `rank` and `candidate_id` in all
  5 event types above (currently fires `agent_recommendation_viewed` / `agent_recommendation_accepted`
  without rank or candidate_id)
- Use `feature` field = agent template name (currently uses `suggestion.source`)
- Use 4-bucket variant mapping (`profile_id % 4`) for agent experiments, overriding the
  existing 2-bucket `getUserVariant` helper
