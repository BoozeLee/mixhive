# MixHive

> A DJ-first social music platform: SoundCloud x social feed x creator growth OS for underground culture.

MixHive lets DJs, producers, organizers, visual artists, and underground creators publish mixes, post short-form Buzz updates, follow each other, discover music scenes, automate fan workflows with Lua agents, and track creator growth from a cyber-hive dashboard.

## Portfolio Summary

This is the flagship full-stack product in the portfolio. It demonstrates product thinking, frontend architecture, Supabase-backed social features, media workflows, agent automation, deployment discipline, and end-to-end validation for a real creator platform.

## Stack

- **Frontend** - Next.js 16 App Router, React 19, TypeScript 6, React Router v7 client bridge
- **UI** - MIXHIVE black/gold cyber-hive system, Tailwind 4 CSS entry, custom hive components
- **Graphics** - Three.js cyber-hive backdrop with CSS fallback
- **Backend** - Supabase Postgres, Auth, Storage, RLS, Realtime
- **Automation** - Vercel Python serverless Lua agent runtime
- **Deploy** - Vercel production deployments and `https://mixhive.vercel.app`

The external `mixhive.app` DNS setup is intentionally deferred until the final launch step.

## Features

- Email + Google OAuth and creator onboarding
- DJ profiles with avatars, banners, genres, social links, badges, analytics, and activity
- Mix upload with audio, artwork, tracklist, genre, tags, explicit flag, waveform generation, and platform links
- Custom waveform player and global persistent bottom player
- Buzz short-form posts with replies, likes, reposts, attachments, and attached mixes
- Social graph with follows, likes, threaded comments, mentions, reposts, blocks, and notifications
- Personalized following feed, trending, latest, discovery, search, and recommendations
- Playlists with ordering
- Creator dashboard for growth metrics, fan activity, top mix signal, and next-best actions
- Lua automation agents with starter templates, public gallery, forking, and run logs
- Verification requests, admin review, and profile analytics
- Embed code generation

## Architecture

```text
src/
├── app/                 # Next App Router shell and catch-all bridge
├── views/               # React Router routed screens
├── components/          # UI, player, hive, social, and media components
├── hooks/               # Custom hooks
├── lib/                 # API client, Supabase, types, agents, player store
└── styles/              # Tokens and global responsive CSS

api/
└── lua-agent/run.py     # Vercel Python Lua worker

supabase/
└── migrations/          # Numbered SQL migrations, RLS, triggers, RPCs
```

Next serves `src/app/[[...slug]]/page.tsx`, which loads the client app from `src/MixHiveClient.tsx`. React Router owns the in-app route tree in `src/App.tsx`.

## Local Development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set these public Supabase values in `.env.local` when using the live backend:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Optional server-side AI keys:

```bash
OPENAI_API_KEY=sk-your-platform-key
HUGGINGFACE_API_KEY=hf_your-platform-key
```

`OPENAI_API_KEY` lets admins use hosted avatar, bio, and genre generation. Regular users can also save their own OpenAI key from Settings. `HUGGINGFACE_API_KEY` enables the Pro hosted art route.

The app expects a Supabase project with migrations applied and storage buckets for audio, artwork, waveforms, profile images, and Buzz media.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next dev server |
| `npm run build` | Build the production Next app |
| `npm run lint` | Run ESLint |
| `npm run preview` | Serve the built app with `next start` |
| `npm run smoke -- --mock-supabase <url>` | Run headless route/console/mobile smoke checks |
| `npm run analyze` | Run bundle analysis build |
| `npm run db:types` | Regenerate `src/lib/database.types.ts` from the linked Supabase project |
| `npm run db:types:check` | Diff live schema against committed generated types |

## Verification

Run the standard local gates before deploy:

```bash
npm run type-check
npm run lint
npm run build
npm run preview -- -p 3003
npm run smoke -- --mock-supabase http://127.0.0.1:3003
```

Vercel production verification:

```bash
vercel deploy --prod --yes
vercel inspect <deployment-url>
npm run smoke -- --mock-supabase https://<deployment-url>
curl -I https://mixhive.vercel.app
```

## Agent Plans

- [Dual-agent build plan](./docs/AGENT_BUILD_PLAN.md)
- [GPT next-phase task plan](./docs/GPT_TASK_PLAN.md)
- [GPT todo checklist](./TODO_GPT_NEXT_PHASE.md)

## Database Types

Schema types in `src/lib/database.types.ts` are generated from the live Supabase project:

```bash
supabase login
supabase link --project-ref <YOUR_PROJECT_REF>
npm run db:types
```

Do not hand-edit generated database types. If migrations change, regenerate and commit the generated file.

## License & Copyright

**Proprietary - All Rights Reserved.**

Copyright (c) 2026 BoozeLee (kiliaanv2@gmail.com). The source is published for portfolio and evaluation purposes only. You may not copy, redistribute, modify, use commercially, run in production, or use to train ML models without explicit prior written permission. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).

"MixHive" is a trademark of the copyright holder.
