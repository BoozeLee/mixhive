# MixHive Hypercube Verification Report

**Verdict: FAIL**  ·  executed 252 cells → ✅ 248 pass · ❌ 4 fail · ⛔ 0 blocked(expected-gate)

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

## Defects (4) — ranked

| sev | target | env | trigger dims | defect | repro |
|---|---|---|---|---|---|
| MEDIUM | `route:/marketplace/agents` | local | data=empty viewport=320 locale=en motion=reduced | axe 1 serious/critical: select-name | `npx playwright test --config hypercube/hypercube.config.ts -g "route:/marketplace/agents ·` |
| MEDIUM | `route:/agents/gallery` | local | data=empty viewport=320 locale=en motion=reduced | axe 2 serious/critical: color-contrast,scrollable-region-focusable | `npx playwright test --config hypercube/hypercube.config.ts -g "route:/agents/gallery · a=a` |
| MEDIUM | `route:/marketplace/gear` | local | data=empty viewport=320 locale=en motion=reduced | axe 1 serious/critical: select-name | `npx playwright test --config hypercube/hypercube.config.ts -g "route:/marketplace/gear · a` |
| MEDIUM | `route:/register` | local | data=empty viewport=320 locale=en motion=full | axe 1 serious/critical: label-title-only | `npx playwright test --config hypercube/hypercube.config.ts -g "route:/register · a=anon d=` |

## Blocked (expected gates / missing creds)

_None._

## Executed by class

| class | pass | fail | blocked |
|---|---|---|---|
| authed-ui | 73 | 0 | 0 |
| public-ui | 175 | 4 | 0 |

_Generated 2026-07-12T17:31:59.914Z from hypercube/results/cells.jsonl_
