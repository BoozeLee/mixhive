# mixhive

DJ-first social platform with AI automation agents, real-time audio visualization, and creator growth analytics.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_%7C_Auth_%7C_Storage-3ecf8e?logo=supabase)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Vercel](https://img.shields.io/badge/Vercel-Deployed-000?logo=vercel)

## Overview

mixhive is a full-stack social platform built for DJs and underground music creators. It combines social networking with AI-powered automation agents to help creators grow their audience and manage their music workflows.

## Key Features

- **Social Graph**: Follow creators, share mixes, discover new artists
- **AI Automation Agents**: Lua-based agents that automate content workflows and engagement
- **Real-time Audio Visualization**: Three.js-powered waveform and frequency visualization
- **Creator Analytics**: Growth tracking, engagement metrics, audience insights
- **Media Management**: Upload, organize, and distribute music content

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS, Three.js
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime)
- **Automation**: Lua scripting agents for content workflows
- **Deployment**: Vercel with CI/CD
- **Design**: Custom UI components, responsive design

## Quick Start

```bash
# Clone the repository
git clone https://github.com/BoozeLee/mixhive.git
cd mixhive

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Run development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
mixhive/
├── app/                  # Next.js App Router
│   ├── (auth)/          # Authentication routes
│   ├── dashboard/       # Creator dashboard
│   ├── explore/         # Discovery and search
│   └── profile/         # User profiles
├── components/          # Reusable UI components
│   ├── ui/             # Base UI primitives
│   ├── audio/          # Audio visualization components
│   └── social/         # Social feed components
├── lib/                # Utilities and helpers
│   ├── supabase/       # Database client and types
│   ├── agents/         # Lua automation agents
│   └── analytics/      # Analytics and metrics
├── public/             # Static assets
└── middleware.ts       # Auth middleware
```

## Architecture

### Agent System
mixhive uses Lua-based automation agents that run on the server side. These agents handle:
- Content scheduling and publishing
- Engagement automation (likes, reposts, follows)
- Analytics aggregation and reporting
- Notification routing

### Real-time Features
- Supabase Realtime for live feed updates
- WebSocket connections for audio visualization sync
- Presence system for online/offline status

## Deployment

The app is deployed on Vercel with automatic deployments on push to main.

[**Live Demo →**](https://mixhive.vercel.app)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT — see [LICENSE](LICENSE) for details.

## Contact

**Kiliaan Vanvoorden** — [bakerstreetbandit@zohomail.eu](mailto:bakerstreetbandit@zohomail.eu)