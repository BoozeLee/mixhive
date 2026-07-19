# MixHive Hypercube Verification Report

**Verdict: PASS-WITH-GATES**  ·  executed 261 cells → ✅ 256 pass · ❌ 0 fail · ⛔ 5 blocked(expected-gate)

Model: t=2 pairwise covering array, **overall ρ = 1.0000** across 399 planned cells (see `generated/coverage.json`).

## Coverage (ρ per class)

| class | plan rows | ρ (pairwise) |
|---|---|---|
| public-ui | 205 | 1.000 |
| authed-ui | 105 | 1.000 |
| admin-ui | 20 | 1.000 |
| public-api | 33 | 1.000 |
| authed-api | 15 | 1.000 |
| gated-api | 12 | 1.000 |
| agent-lua | 1 | 1.000 |
| agent-wasmoon | 1 | 1.000 |
| agent-strategic | 2 | 1.000 |
| agent-notif | 2 | 1.000 |
| agent-session-spirit | 1 | 1.000 |
| agent-audio | 1 | 1.000 |
| agent-aiband | 1 | 1.000 |

## Defects (0) — ranked

_None._

## Blocked (expected gates / missing creds)

- **no-credential** (4 cells, 4 targets): api:POST /api/cron/strategic-agents, api:POST /api/cron/notification-prioritizer, agent:session-spirit, agent:ai-band-bridge
- **no-sample** (1 cells, 1 targets): agent:audio-worker

## Executed by class

| class | pass | fail | blocked |
|---|---|---|---|
| agent-aiband | 0 | 0 | 1 |
| agent-audio | 0 | 0 | 1 |
| agent-lua | 1 | 0 | 0 |
| agent-notif | 1 | 0 | 1 |
| agent-session-spirit | 0 | 0 | 1 |
| agent-strategic | 1 | 0 | 1 |
| agent-wasmoon | 1 | 0 | 0 |
| authed-ui | 73 | 0 | 0 |
| public-ui | 179 | 0 | 0 |

_Generated 2026-07-13T17:44:52.629Z from hypercube/results/cells.jsonl_
