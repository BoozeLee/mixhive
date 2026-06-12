# P6 — Performance, a11y & observability: baseline + changes

_Owner: Claude Code. Date: 2026-06-11. Branch: `p6-perf-a11y-observability`._

## TL;DR

Production is in good shape. The headline P6 win is a **code-split that removes
~1.3 MB of JavaScript from the eager load path**. The "console noise" that looked
alarming in a local build turned out to be **a local-build env artifact, not a real
production bug** — the live site is clean.

## Baseline: local build vs. live production

The smoke harness (`scripts/browser_smoke.py`, 15 routes × 4 viewports incl. 320px)
was run against both a local `next start` build and live `https://mixhive.vercel.app`.

| Signal | Local `next start` | **Live prod** |
|---|---|---|
| Horizontal overflow (incl. 320px) | 0 | **0** |
| JS console errors | 0 | **0** |
| "Invalid Sentry DSN" | 120 | **0** |
| Mixpanel CSP block | 106 | **0** |
| Supabase REST CSP block / literal `undefined` in CSP | 8 | **0** |
| Network 400s (smoke's invalid `test-id` fixtures) | 0 (mocked) | 11 |
| Transient `ERR_HTTP2_PING_FAILED` | 0 | 3 |

**Why the gap:** the local build has no Vercel-injected env, so `next.config.mjs`
interpolates `${supabaseUrl}`/`${cdnUrl}` as the literal string `undefined` (breaking
the CSP), and the placeholder `NEXT_PUBLIC_SENTRY_DSN` / `NEXT_PUBLIC_MIXPANEL_TOKEN`
values in `.env.production` are truthy so Sentry/Mixpanel init with junk. On Vercel,
real env vars override all of this — confirmed by the clean live run. **No 320px
overflow and no JS console errors at any viewport on production.**

## Changes shipped (Claude-owned files)

### Code-split: ~1.3 MB out of the eager bundle
Two heavy libraries were eagerly imported on every route and are now async chunks:

- **`three` (~723 kB)** — `src/components/CyberHiveBackdrop.tsx` now uses a runtime
  `import('three')` inside the mount effect (type-only import kept for annotations).
  It loads **only** when the backdrop actually mounts — never for `prefers-reduced-motion`,
  no-WebGL, or SSR.
- **`mixpanel-browser` (~600 kB)** — `src/components/MixpanelClient.tsx` now dynamic-imports
  it after first paint, and **only when a token is configured** (added a token guard).

Verified absent from the entry build-manifest (i.e. genuinely async). `npm run build`
green; `tsc --noEmit` green; 260 tests pass; smoke shows no `ChunkLoadError` and the
backdrop/analytics still load.

- Removed `src/lib/mixpanel.ts` — orphaned dead code (0 importers) left dangling by the
  refactor. `mixpanelService` / `useMixpanel` were never consumed anywhere.

### Accessibility (WCAG 2 A/AA — axe-core)
Fundamentals were already solid: global `:focus-visible` gold ring (`global.css:90`),
working skip-link, and a `IconButton` that TS-enforces an `aria-label`. An axe-core scan
(`/`, `/login`, `/register`, `/discover`) found one **serious** issue — `link-in-text-block`:
inline links distinguished only by color (WCAG 1.4.1).

- **Fix**: added `text-decoration: underline` to the offending links — the global
  `ConsentBanner` legal links (`src/components/ConsentBanner.tsx`, the actual axe target,
  present on every route) plus the auth-view inline links (`src/views/Login.tsx`,
  `src/views/ForgotPassword.tsx`).
- **Result**: re-scan shows **0 violations (0 serious/critical) on all four routes.**

### Observability: production-safe error boundary
`src/components/ErrorBoundary.tsx` previously rendered the **raw error message, full
stack trace, and a "Copy error details" button to all production users**. Technical
details are now **development-only**; production users get the friendly message + "Try
again" / "Back to feed", while Sentry still receives the full exception in every env.

## Hand to Codex (infra/config — do not patch in product layer)

1. **`.env.production` placeholders** (`NEXT_PUBLIC_SENTRY_DSN=https://your-sentry-dsn…`,
   `NEXT_PUBLIC_MIXPANEL_TOKEN=your-mixpanel-token`). Inert on Vercel (real env overrides)
   but they make any non-Vercel build noisy. Recommend blanking them or using empty values.
2. **CSP `undefined` interpolation** in `next.config.mjs` (`${cdnUrl} ${supabaseUrl}`):
   when those env vars are unset at build, the literal `undefined` lands in the CSP and
   `connect-src` only allows `wss://*.supabase.co`, not the REST `https://` origin. Consider
   filtering falsy values, and/or adding `https://*.supabase.co https://*.supabase.in` to
   `connect-src` as a floor so REST is never blocked.
3. **Mixpanel CSP**: if Mixpanel stays, add `https://api-js.mixpanel.com` (+ `cdn.mixpanel.com`)
   to `connect-src`/`script-src`; otherwise drop the dependency. (Note: avoid paid third-party
   APIs per CLAUDE.md — confirm intent.)
4. **CI Lighthouse budgets** (`.github/workflows/*`): wire a budget (target LCP ≤ 2.5s,
   CLS ≤ 0.1) so the perf win is enforced. The `analyze` script sets `ANALYZE=true` but
   `next.config.mjs` doesn't consume it — `@next/bundle-analyzer` isn't wired, so
   `npm run analyze` currently produces no report.
5. **Legacy Sentry duplication**: `sentry.client.config.js` (placeholder-DSN `|| examplePublicKey`),
   `sentry.server.config.js`, and the Vite-era `src/main.tsx` all init Sentry alongside
   `src/components/SentryClient.tsx`. Consolidate to one client init.

## Recommended follow-up needing `src/App.tsx` coordination (shared file)

- **Per-route error-boundary auto-reset.** Today one `ErrorBoundary` wraps all routes
  (`App.tsx:408`); a crash is contained and recoverable via the fallback buttons, but it
  doesn't auto-clear when the user navigates away. Wiring `resetKeys={[location.pathname]}`
  (or relocating the boundary inside `AnimatedRoutes`, which already has `useLocation`)
  would auto-recover on navigation. Left for coordination since `App.tsx` is shared.
- **Mix/Buzz detail invalid-id handling.** On prod, `/mix/<bad-id>` and `/buzz/<bad-id>`
  emit a console 400 because the Supabase query runs with a non-UUID id. A not-found guard
  before the query would avoid the network error for deleted/invalid links.

## P6 completion — 2026-06-12

The handoff items above are now implemented and production-verified:

- Placeholder optional telemetry credentials are rejected; Sentry is single-init and silent
  without a valid DSN. Mixpanel loads only after analytics consent and never records PII.
- CSP source lists no longer emit `undefined`; both Next and Vercel production CSP allow the
  consent-gated Mixpanel delivery endpoints.
- Lighthouse critical budgets, deterministic bundle budgets, serious/critical axe checks, and
  320px overflow checks run as CI gates. The final bundle measured 4.05 MB across 87 chunks;
  the largest chunk was 723 KB against a 1.5 MB critical cap.
- Route errors reset on navigation. Malformed and deleted Mix/Buzz links render not-found
  without Supabase 400/406 responses.
- `/api/health` now returns safe aggregate status with structured logging. Production release
  `7c1331b` reported database, Redis, audio queue, and push queue healthy with zero failures.

Verification: TypeScript green; 263/263 unit tests green; production build green; 16/16
quality browser gates green; full local mocked-route smoke green. Optional Mixpanel/Sentry
delivery remains disabled until valid provider credentials are configured.
