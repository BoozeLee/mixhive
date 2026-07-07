# MixHive — Path to Launch ("what's next")

Sequenced from `MASTER_ROADMAP.md` + `docs/ENGINEERING_ROADMAP.md`. The core social/creator
platform is already live at https://mixhive.vercel.app; this is the remaining runway to a complete,
launch-ready product. **Payments work stays deferred to the pre-launch gate and is verified in Stripe
TEST mode only — never live keys.**

## 0. In flight now
- **Phase 16** (marketplace/bridge/UI) — merge `feat/phase16-marketplace-bridge-ui` → `main` + deploy (Codex).
- **Repo hygiene follow-ups** (this branch): lint gate re-enabled + debt burn-down (in progress),
  `/api/health` flake fixed, security hardening done + `docs/SECURITY_ROTATION_RUNBOOK.md` (owner runs rotation).

## 1. P14 — Pre-launch quality gate  ⟵ blocks everything below
- **P1** design-system consistency: finish hex→token migration; promote `no-restricted-syntax`
  (raw-hex) rule to `error` once `lint:hex` budget hits 0.
- **P4** converge empty/loading/error states onto shared `EmptyState`/`Skeleton`/`ErrorComponent`.
- **P6** perf/a11y budgets green (Lighthouse, axe); finish the lint zero-errors work.
- **Marketplace**: gear + agent buy→escrow→payout verified in **Stripe TEST**.
- **P8** subscription tiers/paywalls live (Stripe Billing) — TEST mode.
- E2E/CI: real credentials wired so Playwright auth specs run; `test:ci` green (incl. real lint).

## 2. Part I — complete the half-built
- **P9** privacy: deletion-finalization cron (hard delete after 30-day grace), retention automation, localized policies.
- **P10** i18n: wire next-intl strings across views + FR/NL/DE/ES + language switcher.
- **P11** creator studio: analytics 2.0, monthly recap email, EPK polish.
- **P7** external prerequisite: provision TURN VPS → `turn.mixhive.app` + TLS + fail-closed vars.

## 3. Part II — Beehive Studio bridge (separate product)
- **P12** commit/push the Beehive desktop publish client; verify desktop→MixHive round-trip via the
  live `POST /api/bridge/publish`. (Beehive code lives in `/home/kilisan/beehive-studio` — not this repo.)

## 4. Launch & scale
- **P15** closed beta — invite-only first 50 DJs, first paid event.
- **P16** public launch — PR/press/partners/VLAIO.
- **P17+** regional expansion, mobile apps, creator economy (tipping/NFT), API marketplace, scale to 50k+.

## Standing constraints
- MixHive (this repo) and Beehive Studio are **separate products**; only the publish bridge connects them.
- No paid third-party APIs; payments deferred to P14 and TEST-mode only.
- Codex owns infra/config/deploy + final merge; product/UI work lives in `src/views` + `src/components`.
