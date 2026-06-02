# Doc 29 — State-of-the-Art Web/App Design & UX for MIXHIVE

Phase 8 design spec. No code, no migrations. Claude Code implementation handoff.

---

## 1. Design Philosophy

MIXHIVE targets working DJs, producers, rave organisers, and underground culture creators — people who
spend their professional hours in DAWs, on stage, or building scenes. The UI must feel like a tool they
trust, not a social media product trying to entertain them.

**Guiding principle: "dark studio dashboard"**

- Black or deep-grey canvas (`#0a0a0a` / `#111116`) as the base surface — same visual register as
  Ableton, Resolume, and Traktor.
- Accent color is genre-coded: each genre cluster maps to a distinct HSL-shifted hue (e.g. techno →
  electric blue `hsl(210, 90%, 55%)`; drum & bass → acid green `hsl(82, 80%, 48%)`; house →
  amber-gold `hsl(38, 95%, 52%)`). Computed at runtime from a genre → hue-offset table; the user sees
  their genre's color throughout — on cards, progress bars, border highlights.
- Gold/amber (`hsl(38, 95%, 52%)`) is reserved exclusively for MythicNode elements (quest lines,
  graph insights, agent recommendations) so users learn the visual grammar: **gold = your network
  working for you**.
- Typography: single sans-serif family (Inter or DM Sans), weights 400/500/600 only. No decorative
  fonts. Size scale: 11/13/15/18/24/32px — never odd sizes.
- **No rainbow gradients.** No glassmorphism on interactive elements (only on decorative backdrops).
  No neon-on-neon. Premium restraint.

**What "state of the art" means in 2026 for this audience:**

- Information-dense but not cluttered. DJs read BPM, key, and waveform data simultaneously; they
  can handle density if it is organised.
- Responsive across device widths without patronising the user. They work on laptops in green rooms.
- Zero onboarding friction. First action is discoverable within 10 seconds.
- Agents and graph insights surface without demanding attention — they appear at the right moment,
  not as pop-ups that interrupt flow.

---

## 2. Layout System

### 2.1 Shell (Desktop ≥ 1024px)

Three-column layout:

```
┌──────┬────────────────────────────┬──────────────┐
│ Nav  │       Central Canvas       │  Contextual  │
│ 64px │      max-width: 900px      │   Panel      │
│ (or  │      fluid, centered       │   340px      │
│240px)│                            │  (slide-in)  │
└──────┴────────────────────────────┴──────────────┘
```

- **Left nav**: collapses to icon-only (64px) when `viewport < 1280px`; expands to labeled (240px)
  when user hovers/focuses or viewport ≥ 1280px. Icon-only state is the default on 1024–1279px.
  Always a `<nav>` element with ARIA landmarks.
- **Central canvas**: all primary content. Max content width 900px, horizontally centered with
  `auto` margins. Padding: 24px desktop, 16px tablet.
- **Right contextual panel**: 340px fixed-right, slides in with `transform: translateX(340px)` →
  `translateX(0)` (150ms ease-out) when: a MythicNode insight is active, an agent suggestion is
  open, or a graph node is clicked. Overlay on tablet (≤ 1280px), inlined on wide desktop.

### 2.2 Mobile (≤ 767px)

- Single column. No horizontal overflow at 320px (hardcoded test width in smoke tests).
- Bottom navigation bar replaces left nav: 5 icons, 72px height, `position: fixed; bottom: 0`.
  Icons: Feed, Discover, Upload (+), Notifications, Profile.
- Contextual panel becomes a **bottom sheet**: slides up from the bottom, 80vh max height,
  drag-to-dismiss. Uses the existing `BottomSheet` component pattern.
- Cards stack full-width. No two-column grids below 480px.

### 2.3 Tablet (768–1023px)

- Two-column: left nav icon-only (64px) + central canvas (full remaining width). No right panel
  (slides as overlay when needed).

### 2.4 Z-index Ladder

```
Base content:         0–10
Sticky headers:       20
Dropdowns / tooltips: 30
Right panel overlay:  40
Modals:               50
Toasts:               60
```

---

## 3. Motion Vocabulary

Five canonical micro-interactions. All must check `prefers-reduced-motion: reduce` and skip
transforms/animations if set (opacity-only fallback is acceptable).

| Interaction | CSS | Duration | Easing |
|---|---|---|---|
| **Hover lift** | `box-shadow: 0 4px 16px rgba(0,0,0,.4); transform: translateY(-2px)` | 120ms | ease-out |
| **Focus ring** | `outline: 2px solid var(--accent-gold); outline-offset: 2px` | instant | — |
| **Loading skeleton** | shimmer: `background: linear-gradient(90deg, #1a1a1a 25%, #2a2a2a 50%, #1a1a1a 75%); background-size: 200%; animation: shimmer 1.5s ease-in-out infinite` | 1500ms | ease-in-out |
| **Page transition** | `opacity: 0 → 1; transform: translateY(8px) → translateY(0)` | 150ms | ease-out |
| **Notification toast** | slide in from right (`translateX(120%) → translateX(0)`), auto-dismiss after 4s | 200ms in, 150ms out | ease-out |

**Do not animate layout shifts.** Never animate `width`, `height`, or `top`/`left` — only
`transform` and `opacity` to keep animations on the compositor thread.

---

## 4. Hero Flows

The five screens that define the MIXHIVE experience. Each spec includes: layout, key components,
empty state, loading state, error state, and primary CTA.

---

### 4.1 Home Feed + Realtime Notifications

**Purpose:** Main activity stream. First screen after login.

**Layout:**
- Central canvas only (no right panel by default).
- Feed items: full-width cards, 80px min-height, 16px gap between cards.
- Card anatomy: `[avatar 40px] [text block] [action row]` — no images in the text card, audio
  artwork in a separate `MixCard` variant (64px thumbnail left-aligned).

**Key components:**
- `FeedCard` — generic activity (follow, comment, repost). Always shows relative time (e.g. "2h").
- `MixCard` — mix upload or repost. Shows: waveform thumbnail, title, DJ name, duration, play button.
- `MythicPulseCard` — graph-derived event. Gold left-border accent. Body: "Venue X is 2 hops away
  from your scene" or "Collab Cartographer found 3 matches". Dismissible (×). Max 2 per feed page.
- `NotificationBadge` on the bell icon: real-time count via Supabase Realtime subscription to
  `notifications` table. Clears on visit to `/notifications`.

**Realtime updates:** New feed items prepend with a "↑ N new posts" pill at the top (click to
scroll up and reveal). Do not auto-scroll the user — they may be reading.

**Empty state:** "Your feed is quiet. Follow some DJs or explore Discover to fill it up." +
"Explore" CTA button. No sad-face illustrations.

**Loading state:** 3 skeleton cards (avatar circle + 2 text lines + action row).

**Error state:** "Could not load feed. Try refreshing." + Retry button. Never show a stack trace.

---

### 4.2 MythicNode / Quest Dashboard (`/quests`)

**Purpose:** The agent and graph-intelligence hub. Users manage quests, see graph insights, and
review agent recommendations.

**Layout:**
- Central canvas split vertically: top half = quest lanes; bottom = passive insight cards.
- Optional: right panel slides in when clicking a quest card (quest detail + milestone timeline).

**Primary lane (quest progress):**
- Each active quest is a horizontal progress card: `[quest title] [milestone dots] [% bar] [next action CTA]`.
- Sorted by: in-progress first, then proposed, then completed (collapsed).
- "New quest" button top-right — opens `QuestForgeModal`.

**Secondary lane (passive insights):**
- Row of horizontally scrollable cards (desktop) or vertically stacked (mobile).
- Card types: "Scene pulse" (from `scene_radar` agent), "Collab suggestion" (from
  `collab_cartographer`), "Opportunity match" (from `opportunity_scout`).
- Each card: dismissible, single action CTA ("View", "Connect", "Apply"), max 3 visible at a time.
- **Do not show these as modals or toasts.** They live inline in this lane.

**Graph insight callout style:**
```
┌─────────────────────────────────────────────────┐
│ ⚡  You're 2 hops from Fabric London             │
│    via Speedy J → Metalheadz Night → Fabric     │
│    [View connection]               [Dismiss]    │
└─────────────────────────────────────────────────┘
```
Gold left border, `bg: rgba(38, 95%, 52%, .08)` (amber at 8% opacity). Always shows the graph
path in human-readable form, not raw node IDs.

**Empty state (no quests):** "Start your first quest. Quests are AI-guided milestones for your
career — from your first booking to your first label release." + "Create a quest" CTA.

**Loading:** Skeleton for 2 quest cards + 3 insight cards.

---

### 4.3 Collab Session Room (`/session/:id`)

**Purpose:** Real-time co-production workspace. Shared between 2–5 participants.

**Layout:** Full-width, no right panel. Four zones:

```
┌─────────────────────────────┬──────────────┐
│                             │  Presence    │
│   Shared Tracklist Editor   │  Sidebar     │
│   (central, scrollable)     │  (200px)     │
│                             │              │
│ ─────────────────────────── │ ──────────── │
│   Stem Upload Panel         │  Chat        │
│   (bottom third)            │  Overlay     │
└─────────────────────────────┴──────────────┘
```

**Presence sidebar (200px right):**
- Avatar stack showing all connected participants.
- Green dot = active (last heartbeat < 30s). Grey = viewing (< 5min). Red = disconnected.
- "Invite" button at bottom copies session URL to clipboard.

**Shared tracklist editor:**
- Ordered list of tracks. Each row: `[drag handle] [#] [title input] [artist input] [timestamp input] [remove]`.
- Edits broadcast via Supabase Realtime `tracklist_updated` event (see doc 27).
- Optimistic update: apply locally immediately, reconcile on next broadcast.
- Conflict indicator: if two users edit the same row within 2s, show a subtle amber border on
  that row for 3s.

**Stem upload panel:**
- Drag-and-drop zone. Max 500MB per stem, audio formats only.
- Each uploaded stem: filename, size, uploader avatar, timestamp. "Play" + "Remove" buttons.
- Broadcast `stem_added` / `stem_removed` to all participants.

**Chat overlay:**
- Fixed bottom-right, 320×400px, minimisable.
- Messages have: avatar, display name, body, relative timestamp.
- Agent suggestions appear here with a `⚡` prefix and gold background.

**Session state machine (shown in header):**
- `loading` → `active` → `review` → `ended`
- `review` state: shows "Export mix" button. On click: opens export modal, creates
  `session_produced_mix` MythicNode edge.

**Empty state (no participants yet):** "Waiting for others to join. Share the link to invite
collaborators." + copy-link button.

---

### 4.4 Creator Profile + Portfolio (`/profile/:id`)

**Purpose:** Public-facing artist page. Doubles as the owner's personal dashboard.

**Layout:**
- Hero: full-width header image (1440×320 crop), overlaid with avatar (96px circle), name,
  genre tag, city, bio (max 3 lines with "Read more" expand).
- Stats row: Followers · Following · Mixes · Plays · Quests completed.
- Tab bar below stats: `Mixes | Playlists | Quests | NFT Passes | About`

**Mixes tab:** `MixGrid` — 3-column masonry on desktop, 2-column on tablet, 1-column on mobile.
Each card: artwork, title, plays, duration, like count, hover → play preview.

**Quests tab:** Timeline of completed quests (gold checkmarks) and active quests (progress bars).
Collapsed by default; expand on click.

**NFT Passes tab:**
- If viewer is the owner: "Mint a pass" CTA (opens `NftMintModal`). Then grid of collections
  showing: name, token count, soulbound badge, status (`live` / `deploying` / `draft`).
- If viewer is a fan: grid of collections with "Claim" button if `holds_token = false` and
  supply not exhausted. If `holds_token = true`, show a "You hold this pass" badge (gold checkmark).
- Empty state (owner, no collections): "Create your first edition pass to give supporters exclusive
  access to stems, sessions, and quests." + "Mint a pass" CTA.

**About tab:** Extended bio, links (SoundCloud, Instagram, Bandcamp, Resident Advisor), booking
contact (obfuscated, revealed after follow), skills chips (from `artist_skills` table).

---

### 4.5 Agent Gallery + Forge (`/agents`)

**Purpose:** Browse, enable, and customise Lua agents.

**Layout:**
- Central canvas: 2-column card grid (desktop), 1-column (mobile).
- Right panel: agent detail + code editor (slides in on card click).

**Agent card anatomy:**
```
┌──────────────────────────────────────┐
│ ⚡ Scene Navigator          [Active] │
│ Weekly · on_schedule                 │
│ "Finds 5 scene highlights each Mon." │
│ ───────────────────────────────────  │
│ Last run: 2 days ago   [Edit] [Fork] │
└──────────────────────────────────────┘
```
Status badge: `Active` (green), `Paused` (grey), `Error` (red), `Pending approval` (amber).

**Agent forge (right panel / bottom sheet on mobile):**
- Textarea with syntax highlighting (Lua). Line numbers. Max 8000 characters.
- "Test run" button: fires agent with dummy context, shows output in a log panel below.
- Run history: sparkline of last 7 run outcomes (green = success, red = error, grey = no action).

**Empty state (no agents):** Starter template grid — 6 preset cards (Scene Navigator, Collab
Cartographer, Opportunity Scout, plus the 3 existing defaults). Click to install in one step.

---

## 5. Information Hierarchy for MythicNode

The core design challenge: graph insights are valuable but can feel opaque or overwhelming. The
hierarchy below ensures they add value without cognitive overload.

### 5.1 Primary Lane: Actionable Tasks / Quests

Everything with a **clear next step** belongs here. Quest milestone CTAs, collaboration
invitations, opportunity applications, agent suggestions that require approval. Presented as
cards with: title, context sentence, single action button. Max 5 items before "Show more".

### 5.2 Secondary Lane: Passive Insight Cards

Graph-derived observations that are informational but not immediately actionable. Examples:
"Your mix has reached listeners in 4 new cities this week." or "3 artists in your scene just
released new material." These are **dismissible, non-blocking cards** in a horizontal scroll
row on desktop. Never in a modal. Never auto-refreshing mid-session. Updated on page load.

### 5.3 Contextual Callouts (Point-of-Relevance)

Graph insights surfaced at the exact moment of relevance — on an artist card, a venue page, or
an opportunity listing. Pattern: a small subtitle line below the primary info.

```
Jaime Silva                          ←── Artist name
Techno · Berlin                      ←── Subtitle
3 mutual collabs · 2 hops away       ←── Graph insight (small, muted colour)
```

These never appear as badges that overlay artwork or as unsolicited tooltips. They appear inline
in the component that is already showing the entity.

### 5.4 Agent Suggestions (Inbox Pattern)

The `AgentInbox` component in the right panel (or a `/inbox` route on mobile) is the canonical
place for multi-step agent suggestions. The inbox metaphor sets expectations: you check it
when you're ready, not in response to a ping. Unread count on the bell icon; no push
notifications unless the user opts in.

---

## 6. NFT / Wallet UX Framing

### 6.1 Language Rules

| ❌ Never say | ✅ Say instead |
|---|---|
| Mint | Release / Create edition |
| Claim token | Unlock / Get your pass |
| Burn | Revoke access |
| Floor price | — (never show price) |
| Gas fees | Covered by MIXHIVE |
| Smart contract | — (never surface to user) |
| Token ID | Pass # |

### 6.2 Placement Rules

- Wallet and NFT CTAs appear **only** on: the NFT Passes tab of a creator's profile, the Quest
  detail page (fan backing), and the Tour Weaver gig log confirmation screen.
- **Zero NFT UI on**: home feed, discover, search, notifications, the player, or any onboarding
  flow. Core features must work without a wallet.

### 6.3 Plain-Language Copy for the 3 Use Cases

**Mix pass (limited edition):**
> "Support this release and get early access to stems + a private collab invite."
> "N of N passes available. Free to claim — gas covered."

**Soulbound gig proof:**
> "You were at [Event Name]. This digital receipt is yours forever and can't be transferred."
> "Claim your attendance proof." (one-tap; no wallet needed for soulbound if MIXHIVE covers gas)

**Quest backing:**
> "Back this artist's quest. If they complete it, you'll get a provenance receipt."
> "N fans are backing this quest."

### 6.4 Wallet Connection Flow (Summary — full spec in doc 34)

1. Settings → Web3 & NFTs → "Connect Wallet" (not visible until user navigates there).
2. Modal: MetaMask / Coinbase / "No wallet yet" (no lock-in, user can exit).
3. Sign message → profile linked → address badge appears on profile (truncated: `0x1234…abcd`).
4. Disconnect available at any time; no data is lost, graph edges are soft-deleted.

---

## 7. Codex & Claude Code Handoff

**Codex handoff:** None. This doc is design-system guidance only.

**Claude Code handoff:**
- `src/styles/tokens.ts` — add `genreAccentHue` function: `(genre: string): string` that maps
  genre string to HSL hue offset; use in card borders and progress bars.
- `src/app/mixhive.css` — add shimmer keyframe animation (loading skeleton).
- `src/views/` hero flows above define expected layout, empty, loading, and error states for:
  Feed (`src/views/FeedView.tsx`), QuestDashboard (`src/views/QuestDashboard.tsx`),
  CollabSessionRoom (`src/views/CollabSessionRoom.tsx`), EnhancedProfilePage
  (`src/views/EnhancedProfilePage.tsx`), AgentGallery (`src/views/AgentGallery.tsx`).
- Motion constants to add to tokens.ts: `duration.fast = '120ms'`, `duration.base = '150ms'`,
  `easing.out = 'cubic-bezier(0.0, 0.0, 0.2, 1)'`.
