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

## Contributing

This repository is private during initial development. Internal contributors should branch from `main`, open a PR, and require one passing CI run before merging. Use rebase or squash — no merge commits.

See [`.github/CONTRIBUTING.md`](./.github/CONTRIBUTING.md) for details.

## License

[MIT](./LICENSE) © 2026 MixHive
