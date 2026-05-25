# MixHive

> A DJ-first social music platform — think Facebook meets SoundCloud, built for mixers.

MixHive lets DJs upload mixes with tracklists, artwork and platform links, follow each other, and discover new sound through a personalized feed, trending charts, and curated playlists. Built with React 19, Vite, and Supabase.

## Stack

- **Frontend** — React 19 + TypeScript 6 + Vite 8 + react-router-dom v7
- **Backend** — Supabase (Postgres, Auth, Storage, RLS, Realtime)
- **Deploy** — Vercel (SPA) + Supabase (managed)

## Features

- Email + Google OAuth, DJ profiles with onboarding
- Mix upload with audio, artwork, tracklist, genre, tags, explicit flag, platform links
- Custom waveform player with seek, volume, mute, keyboard shortcuts
- Global persistent bottom player with queue
- Social — follows, likes, threaded comments, mentions, reposts, blocks
- Personalized feed, trending, latest, discovery, "fans also liked"
- Playlists with drag-to-reorder
- Notifications — likes, follows, comments, replies, mentions, mix uploads
- Search across mixes and DJs
- Embed code generation

## Architecture

```
src/
├── components/   # UI components (player, waveform, queue, cards, social)
├── pages/        # Routed pages (feed, mix detail, upload, edit, profile, search)
├── hooks/        # Custom hooks (useAuth)
├── lib/          # API client, types, supabase, player store, waveform utils
└── assets/

supabase/
└── migrations/   # SQL migrations (schema, RLS, triggers, feed RPCs)
```

## Local Development

```bash
# 1. Install deps
npm install

# 2. Copy env example and fill in your Supabase project credentials
cp .env.example .env.local
# Edit .env.local — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# 3. Run dev server
npm run dev
```

The app expects an initialised Supabase project with the migrations from `supabase/migrations/` applied. Storage buckets `mix-audio`, `mix-artwork`, `mix-waveforms`, and `mixes-original` must exist (the first migration creates them).

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Vite dev server |
| `npm run build` | Type check + production build |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview built output |
| `npm run db:types` | Regenerate `src/lib/database.types.ts` from the linked Supabase project |
| `npm run db:types:check` | Diff live schema against the committed types (CI uses this) |

## Database types

Schema types in `src/lib/database.types.ts` are auto-generated from the live Supabase project. To populate or refresh them:

```bash
# one-time setup
supabase login
supabase link --project-ref <YOUR_PROJECT_REF>

# whenever migrations change
npm run db:types
git add src/lib/database.types.ts
git commit -m "chore(db): regenerate schema types"
```

A `Schema drift` GitHub Actions job runs on PRs that touch migrations or generated types; it fails the build if the committed file is stale. The job is opt-in — set the repo variable `SCHEMA_DRIFT_ENABLED=true` and the secrets `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF` to enable it.

## Contributing

This repository is private during initial development. Internal contributors should branch from `main`, open a PR, and require one passing CI run before merging. Use rebase or squash — no merge commits.

See [`.github/CONTRIBUTING.md`](./.github/CONTRIBUTING.md) for details.

## License & Copyright

**Proprietary — All Rights Reserved.**

Copyright © 2026 BoozeLee (kiliaanv2@gmail.com). The source is published for
portfolio / evaluation purposes only. You may **not** copy, redistribute,
modify, use commercially, run in production, or use to train ML models
without explicit prior written permission. See [LICENSE](./LICENSE) for the
full terms and [NOTICE](./NOTICE) for the copyright notice.

"MixHive" is a trademark of the copyright holder.

To request a license, email kiliaanv2@gmail.com with subject "MixHive — License Request".
