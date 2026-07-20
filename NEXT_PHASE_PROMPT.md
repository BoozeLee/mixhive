# Next Phase Prompt — MixHive Phase 17: Real-Time Collab & Events

**Generated:** 2026-07-19
**Status:** Ready for execution
**Branch:** `feat/hypercube-verification` (current, 3 commits ahead)
**Last migration:** 111 (ai_art_studio)
**Production:** https://mixhive.vercel.app ✅ live

---

## System Context

MixHive is a DJ-first social music platform (Facebook × SoundCloud) built with:
- **Frontend:** Next.js 16 App Router, React 19, TypeScript 6, React Router v7 (client bridge)
- **Backend:** Supabase (Postgres, Auth, Storage, RLS, Realtime)
- **Infra:** Vercel production deploys, Python serverless Lua agent runtime
- **Style:** Black/gold cyber-hive brand, Tailwind 4, `src/app/mixhive.css`
- **Agents:** Claude Code owns `src/views/*`, `src/components/*`, `src/styles/tokens.ts`. Codex owns infra/config.

### Current Route Tree (65+ views)
Core: Landing, Feed, Discover, Search, Profile, MixDetail, Upload, EditMix, Settings, Notifications, Messages
Social: Scenes, SceneDetail, CollabQuests, CollabQuestDetail, CollabSessionRoom, LiveRituals
Marketplace: GearMarketplace, GearListingDetail, NewGearListing, AgentMarketplace, AgentTracks, AIBandIndex, AIBandDetail
AI/Creative: ArtStudio, AvatarStudio, HiveComposer, AgentsGallery, Agents, PressKitStudio, PublicPressKit
Admin: AdminVerification, AdminModeration, Dashboard, Earnings, Leaderboard
Content: HiveStory, HiveStoryLanding, HiveStoryIssue, QuestsList, QuestDetail, Hub
Auth: Login, Register, ForgotPassword, ResetPassword, AuthCallback, DevLogin, ProfileSetup
Legal: Privacy, Terms, CookiePolicy, PricingPage

### Existing Database Tables (111 migrations)
Key tables: `mixes`, `profiles`, `playlists`, `scenes`, `collab_quests`, `collab_sessions`, `collab_participants`, `gear_listings`, `gear_transactions`, `agent_listings`, `agent_purchases`, `ai_art_generations`, `notifications`, `messages`, `message_threads`, `xp_entries`, `reputation_entries`, `mythic_nodes`, `mythic_edges`, `live_rituals`, `push_subscriptions`, `consent_preferences`, `deletion_requests`, `user_subscriptions`, `subscription_tiers`, `nft_provenance`, `buzzes`, `comments`, `reposts`, `follows`, `bookmarks`, `reports`

---

## Phase 17: Real-Time Collaboration & Events v1

### Why This Phase
Phase 16 delivered gear escrow, RPG/reputation, Beehive Studio Bridge, and agent marketplace tiers. The platform's social core — real-time DJ collaboration and event organization — remains underserved. Phase 17 closes the loop on MixHive's "Facebook × SoundCloud" promise by making live collaboration and event discovery first-class features.

### What This Phase Builds

#### Slice 1: Live Collab Rooms (Real-Time DJ Sessions)
**Goal:** DJs can create/join live rooms, see each other's waveforms, chat, and co-mix in real-time.

**Database (Migration 112):**
```sql
-- Live room state
CREATE TABLE IF NOT EXISTS live_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  scene_id UUID REFERENCES scenes(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Untitled Session',
  description TEXT,
  max_participants INT NOT NULL DEFAULT 8,
  is_public BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','live','ended')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS live_room_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES live_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'listener' CHECK (role IN ('host','dj','listener')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ,
  UNIQUE(room_id, user_id)
);

CREATE TABLE IF NOT EXISTS live_room_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES live_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Realtime presence
ALTER PUBLICATION supabase_realtime ADD TABLE live_room_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE live_room_messages;
```

**API Routes:**
- `POST /api/live-rooms` — create room (auth required)
- `GET /api/live-rooms` — list active public rooms
- `GET /api/live-rooms/[id]` — get room details + participants
- `POST /api/live-rooms/[id]/join` — join room (auth required, capacity check)
- `POST /api/live-rooms/[id]/leave` — leave room
- `POST /api/live-rooms/[id]/end` — end room (host only)
- `GET /api/live-rooms/[id]/messages` — paginated chat history

**Views/Components:**
- `src/views/LiveRooms.tsx` — room browser (grid cards with live indicators)
- `src/views/LiveRoom.tsx` — active room view (participants, waveform, chat, controls)
- `src/components/live/RoomCard.tsx` — room preview card
- `src/components/live/ParticipantList.tsx` — participant avatars with role badges
- `src/components/live/RoomChat.tsx` — real-time chat via Supabase Realtime
- `src/components/live/WaveformSync.tsx` — shared waveform display placeholder
- `src/components/live/RoomControls.tsx` — invite, mute, kick, end session

**Routes in App.tsx:**
```
/live-rooms          → LiveRooms (public)
/live-rooms/:id      → LiveRoom (auth required for participation)
```

**i18n keys (en, fr, de, es, nl):**
```json
{
  "liveRooms": {
    "title": "Live Rooms",
    "subtitle": "Join real-time DJ sessions",
    "createRoom": "Create Room",
    "joinRoom": "Join",
    "leaveRoom": "Leave",
    "endSession": "End Session",
    "waiting": "Waiting to start",
    "live": "LIVE",
    "ended": "Session ended",
    "participants": "Participants",
    "chat": "Chat",
    "sendMessage": "Send",
    "emptyTitle": "No live rooms right now",
    "emptyDescription": "Create one and start mixing with others.",
    "roomFull": "Room is full",
    "hostControls": "Host Controls",
    "role_host": "Host",
    "role_dj": "DJ",
    "role_listener": "Listener"
  }
}
```

**RLS Policies:**
- `live_rooms`: Public read for `status = 'live'`. Auth insert. Host update/delete.
- `live_room_participants`: Public read. Auth insert (self). Self delete (leave). Host delete (kick).
- `live_room_messages`: Public read for participants. Auth insert (self).

---

#### Slice 2: Events v1 (Rave & Party Listings)
**Goal:** Organizers can create events, attendees can RSVP, events appear in Discover.

**Database (Migration 113):**
```sql
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  scene_id UUID REFERENCES scenes(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  venue_name TEXT,
  venue_address TEXT,
  cover_image_url TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  max_attendees INT,
  is_free BOOLEAN NOT NULL DEFAULT true,
  ticket_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','cancelled','completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'going' CHECK (status IN ('going','maybe','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);
```

**API Routes:**
- `POST /api/events` — create event (auth required)
- `GET /api/events` — list published events (paginated, filterable by scene/date)
- `GET /api/events/[id]` — event details + RSVP count
- `PUT /api/events/[id]` — update event (organizer only)
- `DELETE /api/events/[id]` — cancel event (organizer only)
- `POST /api/events/[id]/rsvp` — RSVP (auth required)
- `DELETE /api/events/[id]/rsvp` — cancel RSVP

**Views/Components:**
- `src/views/Events.tsx` — event browser (calendar + list toggle, scene filter)
- `src/views/EventDetail.tsx` — event page (description, venue, RSVPs, map placeholder)
- `src/views/NewEvent.tsx` — create event form
- `src/components/events/EventCard.tsx` — event preview card
- `src/components/events/RSVPButton.tsx` — going/maybe/cancel toggle
- `src/components/events/AttendeeList.tsx` — RSVP'd user avatars

**Routes in App.tsx:**
```
/events              → Events (public)
/events/new          → NewEvent (auth required)
/events/:id          → EventDetail (public)
/events/:id/edit     → NewEvent (organizer, reuse with prefill)
```

**i18n keys (en, fr, de, es, nl):**
```json
{
  "events": {
    "title": "Events",
    "subtitle": "Raves, sessions, and meetups",
    "createEvent": "Create Event",
    "editEvent": "Edit Event",
    "rsvpGoing": "Going",
    "rsvpMaybe": "Maybe",
    "rsvpCancel": "Cancel RSVP",
    "attendees": "Attendees",
    "noEvents": "No upcoming events",
    "noEventsDescription": "Organize a rave and let the hive know.",
    "free": "Free",
    "ticketRequired": "Ticket required",
    "pastEvent": "This event has ended",
    "cancelled": "Event cancelled",
    "byOrganizer": "by {name}",
    "maxAttendees": "{count} spots left"
  }
}
```

**RLS Policies:**
- `events`: Public read for `status = 'published'`. Auth insert. Organizer update/delete.
- `event_rsvps`: Public read. Auth insert/update/delete (self).

---

#### Slice 3: Discover Events Integration
**Goal:** Events surface in the existing Discover page as a new lane.

**Changes to `src/views/Discover.tsx`:**
- Add "Events" lane alongside existing lanes
- Fetch from `GET /api/events?limit=6&status=published&upcoming=true`
- Event cards show date, venue, RSVP count, cover image
- Link to `/events/:id`

**Changes to `src/components/discover/DiscoverLane.tsx`:**
- Support `eventType` lane variant with date-focused card layout

---

#### Slice 4: Collab Session v2 (Post-Quest Completion)
**Goal:** After a collab quest completes, participants can continue in a live room.

**Changes to `src/views/CollabQuestDetail.tsx`:**
- Add "Continue in Live Room" button when quest status = `completed`
- Creates a live room pre-populated with quest participants
- Links to new live room

**Changes to `POST /api/quests/collab/[id]/complete`:**
- Return `live_room_id` if a room was auto-created

---

#### Slice 5: Notification Expansion
**Goal:** Live rooms and events generate appropriate notifications.

**Changes to Migration 114 (or extend 113):**
```sql
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (...existing..., 'live_room_invite', 'live_room_started', 'event_reminder', 'event_update', 'rsvp_confirmed'));
```

**Notification handlers:**
- `live_room_invite`: " invited you to a live room"
- `live_room_started`: " started a live session"
- `event_reminder`: " is happening in 1 hour"
- `event_update`: " updated an event"
- `rsvp_confirmed`: " is going to "

---

### Implementation Order

```
1. Migration 112 (live_rooms)          → DB foundation
2. Migration 113 (events)              → DB foundation
3. Live Room API routes                → Backend
4. Live Rooms view + components        → Frontend
5. Events API routes                   → Backend
6. Events view + components            → Frontend
7. Discover integration                → Wire into existing
8. Collab Quest → Live Room bridge     → Connect slices
9. Notification expansion              → Migration 114 + handlers
10. i18n sweep (5 locales)             → All new strings
11. App.tsx route registration         → Route tree
12. tsc + lint + build + smoke         → Verification
13. Commit + push + Vercel deploy      → Ship
```

### Acceptance Criteria

| # | Criterion | Test |
|---|-----------|------|
| 1 | Can create a live room via UI | POST /api/live-rooms returns 201 |
| 2 | Can list active rooms | GET /api/live-rooms returns array |
| 3 | Can join/leave a room | POST .../join returns 200, participant appears |
| 4 | Room chat messages persist | GET .../messages returns history |
| 5 | Can create an event via UI | POST /api/events returns 201 |
| 6 | Can RSVP to an event | POST .../rsvp returns 200 |
| 7 | Events appear in Discover | /discover shows events lane |
| 8 | Collab quest → live room link works | Complete quest creates room |
| 9 | Notifications fire on invites/RSVPs | Notification row created |
| 10 | All routes return 200/401 correctly | curl smoke |
| 11 | tsc --noEmit clean | TypeScript check |
| 12 | npm run lint clean | ESLint check |
| 13 | npm run build passes | Production build |
| 14 | Mobile stable at 320px | No horizontal overflow |

### Guardrails

- Do NOT edit existing migrations. Add new numbered migrations only.
- Do NOT disable RLS or use service-role key from browser code.
- Do NOT add paid third-party APIs.
- Do NOT commit `.env*` files.
- Do NOT break existing routes — all 65+ views must still work.
- Keep UI consistent with black/gold cyber-hive brand.
- Use tokenized colors from `src/styles/tokens.ts`.
- Use existing form components from `src/components/ui/` before raw controls.
- Buttons must be real `<button>` elements with labels.
- Respect `prefers-reduced-motion`.
- Run `npx tsc --noEmit && npm run lint && npm run build` before commit.

### Conventions

- Lazy-load all new views in `src/App.tsx`
- Use `resolveAiContext()` for auth context (pattern from existing API routes)
- Use `useTranslations()` for all user-facing strings
- Use `formatZodError()` for validation errors
- Supabase Realtime subscriptions via existing `src/lib/supabase.ts` client
- Mobile-first layouts: test at 320px, 768px, 1024px

---

## Usage

This document is designed to be fed to any AI coding agent (Claude Code, Codex, etc.) as a complete execution brief. The agent should:

1. Read this document as the full specification
2. Follow the implementation order
3. Create migration files in `supabase/migrations/`
4. Create API routes in `src/app/api/`
5. Create views in `src/views/`
6. Create components in `src/components/`
7. Add i18n keys to all 5 locale files
8. Register routes in `src/App.tsx`
9. Run verification commands before commit
10. Commit with conventional commit format: `feat(phase17): ...`

### Commit Format
```
feat(phase17): add live rooms foundation (DB + API + UI)
feat(phase17): add events v1 (DB + API + UI)
feat(phase17): integrate events into Discover lane
feat(phase17): bridge collab quest to live rooms
feat(phase17): expand notification types for live rooms + events
feat(phase17): add i18n for live rooms + events (en,fr,de,es,nl)
```
