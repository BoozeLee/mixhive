# Auth & Supabase Wiring — Discovery Notes

Recorded 2026-05-31. Reflects the state after Phase 1 fixes.

## Env vars used in the browser

Primary (Next.js): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`  
Fallback (legacy Vite): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

Logic lives in `src/lib/supabase.ts`:
- If both `NEXT_PUBLIC_*` vars are present, use them exclusively.
- Otherwise fall back to `VITE_*`.
- `next.config.mjs` bakes the resolved values into `env.NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` at build time, so both work in client bundles.

Server-only: `SUPABASE_SERVICE_ROLE_KEY` — accessed only inside `createServerClient()` in `src/lib/supabase.ts`. Never exposed to the browser.

All production Vercel env vars confirmed set:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CLIENT_SECRET`, `VITE_SUPABASE_*` (legacy, keep until full migration).

## Route inventory

| URL | Handler | Notes |
|-----|---------|-------|
| `/auth/login` | `src/views/auth/Login.tsx` (React Router via catch-all) | email + Google button |
| `/auth/register` | `src/views/auth/Register.tsx` (React Router via catch-all) | email + Google button |
| `/auth/callback` | `src/app/auth/callback/page.tsx` (Next.js App Router) | intercepts before catch-all |
| `/feed` | `src/app/[[...slug]]/page.tsx` → React Router → `src/views/Feed.tsx` | |

**Important:** `src/app/auth/callback/page.tsx` is a static App Router route that wins over the
`[[...slug]]` catch-all. The React Router `AuthCallback` components listed below are dead code
for this URL path.

## Where `exchangeCodeForSession` is called

**Active:** `src/app/auth/callback/page.tsx` — client component, extracts `code` from
`window.location.search`, calls `supabase.auth.exchangeCodeForSession(code)`, redirects to `/feed`.
PKCE code verifier is stored in localStorage by the Supabase JS client before the OAuth redirect,
so client-side exchange is correct for this architecture (`@supabase/ssr` is not installed).

**Dead code (never runs for `/auth/callback`):**
- `src/views/AuthCallback.tsx` — correct PKCE implementation but unreachable; React Router
  never sees `/auth/callback` because the App Router page intercepts first.
- `src/views/auth/AuthCallback.tsx` — old implicit-flow implementation (reads `access_token`
  from URL hash); wrong for PKCE, also unreachable.

## Google OAuth flow

1. User clicks "Continue with Google" in `Login.tsx` or `Register.tsx`.
2. `useAuth.signInWithGoogle()` calls `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: '<origin>/auth/callback' } })`.
3. Supabase returns a Google authorize URL; the browser redirects to it.
4. Google authenticates the user and redirects to `https://ljdolmqytncxhgojqguh.supabase.co/auth/v1/callback` (the Supabase OAuth callback).
5. Supabase exchanges the Google code for a Supabase session and redirects to `<origin>/auth/callback?code=<pkce-code>`.
6. `src/app/auth/callback/page.tsx` extracts `code`, calls `exchangeCodeForSession(code)`, and redirects to `/feed`.

## Remaining manual checklist

### Supabase Dashboard — URL Configuration
- [ ] Site URL: `https://mixhive.vercel.app` (or `https://mixhive.app` once DNS is live)
- [ ] Redirect URLs include:
  - `https://mixhive.vercel.app/auth/callback`
  - `https://mixhive.app/auth/callback`
  - `http://localhost:3000/auth/callback`

### After confirming OAuth works end-to-end
- [ ] Rotate Google client secret (`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` was in a local downloads file)
- [ ] Update Vercel `GOOGLE_CLIENT_SECRET` with the new value
- [ ] Run: `export GOOGLE_CLIENT_SECRET=<new> && supabase secrets set GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET && supabase config push --yes`

### Upstash Redis
- [ ] Renew or reprovision (check expiry in Upstash console — was flagged as expiring 2026-05-31)
- [ ] Update `REDIS_URL` in Vercel if reprovisioning
