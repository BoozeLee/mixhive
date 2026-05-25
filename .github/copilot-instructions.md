# Copilot Instructions — MixHive

You are working in the MixHive repository: a DJ-focused social music platform.

## Stack & Conventions

- **Frontend**: React 19 + TypeScript 6 (strict) + Vite 8 + react-router-dom v7
- **Backend**: Supabase (Postgres, Auth, Storage, RLS, Realtime)
- **Deploy**: Vercel (SPA) + Supabase (managed)
- **Styling**: Inline styles with a dark theme — accent `#f0c040`, surface `#0f0f0f`, border `#1a1a2e`. Do not introduce Tailwind or CSS frameworks unless asked.

## Architecture

The codebase follows a thin-client + RPC pattern:

- `src/lib/supabase.ts` — single Supabase client instance
- `src/lib/api.ts` — all server interactions (queries, mutations, RPCs) live here
- `src/lib/types.ts` — all shared TypeScript types
- `src/lib/playerStore.tsx` — global player context (current track, queue, audio element)
- `src/components/` — UI components (presentational + small smart components)
- `src/pages/` — routed pages
- `src/hooks/useAuth.ts` — auth state hook
- `supabase/migrations/` — numbered SQL migrations (`NNN_description.sql`)

## Code Style

- Strict TypeScript. No `any`. Prefer narrow types and discriminated unions.
- Function components + hooks only. No class components.
- Keep components small; extract hooks when state grows.
- Use existing storage bucket constants from `src/lib/api.ts` (`AUDIO_BUCKET`, `ARTWORK_BUCKET`, `WAVEFORM_BUCKET`, `ORIGINAL_BUCKET`).
- Use existing player context (`usePlayer()`) — never create a parallel global audio singleton.
- Error handling: surface user-friendly errors via local state; never throw across component boundaries silently.

## Database & Supabase

- All tables have RLS enabled. Do not modify existing policies unless explicitly asked — they are security-critical.
- Add a new numbered migration file rather than editing existing ones.
- New tables must include `id uuid default gen_random_uuid()`, `created_at`, and `updated_at`.
- Add indexes for any column used in `WHERE`, `ORDER BY`, or joins on hot paths.
- Prefer Postgres functions / RPCs over multi-step client queries when data needs to be assembled server-side.

## Patterns to Reuse

- Notifications: extend the `notifications.type` enum + add a trigger in a new migration. Update `Notification['type']` in `src/lib/types.ts` to match.
- Feeds: feed_events fan-out is already wired. New feed types should be added there, not in a parallel table.
- Mentions: `parseMentions()` in `src/lib/types.ts` already exists. Reuse it.
- Cursor pagination: existing pattern uses `created_at + id` (latest), `score + id` (trending). Follow the same shape for new feeds.

## Security

- Never put secrets in frontend code or commit them. All secrets go in Vercel env vars or Supabase project settings.
- `VITE_*` env vars are bundled into the client; assume they are public.
- Validate uploaded file types and sizes client-side AND in Supabase storage policies.

## What NOT To Do

- Don't add new state managers (Redux, Zustand, etc.) — context + useState is the chosen pattern.
- Don't replace inline styles with a CSS framework.
- Don't introduce a server runtime — backend logic belongs in Postgres functions / Supabase Edge Functions, not Vercel serverless.
- Don't drop or rename existing columns. Add new ones and deprecate.
- Don't disable RLS or use the service role key from the browser.

## When in Doubt

Read `src/lib/api.ts` and the most recent migration to learn the project's idioms before writing new code. Match the existing style.
