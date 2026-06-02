# Realtime Collaborative Session — Technical Architecture (Phase 7)

**"The product PRD says what to build. This doc says how."**

**Status:** Technical architecture spec — ready for Codex + Claude Code implementation  
**Date:** 31 May 2026  
**Extends:** `22-mythic-co-production-sessions-prd.md` (product PRD) · `050_collab_sessions_foundation.sql` (schema)  
**Also read:** `src/lib/websocket.ts` (existing Realtime layer) · `src/components/StartMythicSessionModal.tsx` (stub)

---

## 1. MVP Scope

### In scope (Phase 8 implementation)

- **Co-editing of session metadata:** tracklist (ordered list of stems/segments), session notes, mix timestamps
- **Presence:** who is in the session room, when they joined, cursor position on the tracklist
- **Chat overlay:** text messages within the session (stored in `collab_sessions.metadata.chat`)
- **Stem file list sync:** participants see the same list of uploaded stem files (URLs from Supabase Storage); no audio mixing in-browser
- **Session → graph attribution:** automatic MythicNode edges on session events

### Out of scope (not this phase)

| Feature | Why deferred |
|---|---|
| PCM-level audio editing (DAW) | Requires WASM audio worklet + audio graph sync; 10× scope |
| CRDT for concurrent text edits | Overkill at MVP; last-write-wins is acceptable for notes/tracklist |
| Audio streaming between participants | WebRTC talkback is design-only at this stage |
| Session recording/playback | Post-MVP; requires dedicated storage and video codec decisions |
| Mobile-first session room | Desktop-first MVP; mobile collab deferred |

---

## 2. Supabase Realtime Channel Design

Each active session gets exactly two Realtime channels. Both are authenticated — Supabase validates the JWT before allowing subscribe/broadcast.

### Channel 1: `session:{id}:presence`

**Technology:** Supabase Presence API (CRDT-backed, server-managed)  
**Purpose:** Track who is in the room; surface typing indicators; track tracklist cursor position

**Presence state shape (per participant):**

```typescript
interface SessionPresence {
  profile_id: string;
  display_name: string;
  avatar_url: string | null;
  cursor_position: number | null;  // index in the tracklist array, null if not focused
  last_active: string;             // ISO timestamp, updated on any user action
  status: 'active' | 'idle';      // idle if no action in last 60s
}
```

**Lifecycle:**
- On join: `channel.track(presence_state)` immediately after subscribing
- On leave: Supabase automatically removes stale presence within 10s of disconnect
- On cursor move: `channel.track({ ...current_state, cursor_position: newIndex })`
- Clients listen: `channel.on('presence', { event: 'sync' }, handler)` — renders the sidebar participant list

### Channel 2: `session:{id}:state`

**Technology:** Supabase Realtime Broadcast  
**Purpose:** Push state change events to all participants; last-write-wins conflict resolution

**Broadcast event types:**

```typescript
type SessionEvent =
  | { type: 'tracklist_updated'; payload: { tracklist: TracklistItem[]; version: number; author_id: string } }
  | { type: 'note_updated';      payload: { notes: string; version: number; author_id: string } }
  | { type: 'stem_added';        payload: { stem: StemFile; author_id: string } }
  | { type: 'stem_removed';      payload: { stem_id: string; author_id: string } }
  | { type: 'chat_message';      payload: { text: string; author_id: string; timestamp: string } }
  | { type: 'session_ended';     payload: { ended_by: string } }
  | { type: 'mix_exported';      payload: { mix_id: string; exported_by: string } };
```

**Broadcast flow:**

```
Client A makes a change
  → Updates local state
  → Writes to DB (PATCH /api/mythic/sessions/{id})
  → Broadcasts event on channel
Client B receives broadcast
  → Merges event into local state (last-write-wins by version number)
  → Re-renders affected panels
```

The DB write and the broadcast are both fired in the same client action handler. The DB is the source of truth; the broadcast is for UX speed (optimistic update without polling).

---

## 3. Conflict Resolution

**Strategy: last-write-wins on `collab_sessions.metadata` jsonb**

At MVP, the `metadata` column in `collab_sessions` is a jsonb blob containing:

```json
{
  "tracklist": [{ "id": "...", "title": "...", "position": 0, "stem_url": "..." }],
  "notes": "...",
  "stems": [{ "id": "...", "filename": "...", "url": "...", "uploaded_by": "...", "uploaded_at": "..." }],
  "chat": [{ "author_id": "...", "text": "...", "timestamp": "..." }],
  "version": 42
}
```

Each write increments `version`. The DB update uses:

```sql
UPDATE collab_sessions
SET metadata = $new_metadata,
    updated_at = now()
WHERE id = $session_id
  AND (metadata->>'version')::int <= $expected_version;
```

If the `expected_version` check fails (someone wrote concurrently), the client retries by re-fetching the current state and re-applying its change. This is acceptable for tracklist edits (rare concurrent writes) and fails gracefully for chat (append-only, can just retry).

**Phase 9 upgrade path:** Replace the metadata blob with an Automerge or Yjs CRDT stored as a binary column; use the existing Realtime broadcast to propagate CRDT updates instead of full-state snapshots.

---

## 4. MythicNode Integration

Every session lifecycle event writes to the graph. All writes are fire-and-forget — never block the user-facing action on graph writes.

| Session event | Graph action |
|---|---|
| Session created | Insert `collab_session` node (`source_table='collab_sessions'`, `source_id=session.id`) |
| Participant joins | Insert or update `collab_with` edge: `(participant_node → owner_node)` with `metadata.status = 'pending'`; if both participants are in the room, upgrade to `'confirmed'` |
| Participant leaves | Update `collab_with` edge `metadata.last_active` |
| Mix exported from session | Insert `session_produced_mix` edge: `(collab_session_node → mix_node)` with `metadata.session_id, exported_at` |
| Session ended | Update `collab_session` node `payload.status = 'ended'`; fire `quest_milestone` proposal for any active quest with `collab_with` in its milestone conditions |

### Quest milestone proposal on mix export

When a mix is exported from a collab session, check if the owner has an active quest whose title or tags suggest a collab milestone:

```typescript
// In the mix-export handler, after creating session_produced_mix edge:
const { data: quests } = await sb
  .from('quests')
  .select('id, title')
  .eq('owner_id', userId)
  .eq('status', 'active');

for (const quest of quests ?? []) {
  // Propose a milestone: "Collab with {partner} — from session {title}"
  void sb.from('quest_milestones').insert({
    quest_id: quest.id,
    title: `Co-produced a mix from session "${session.title}"`,
    status: 'proposed',
    progress: { session_id: sessionId, partner_id: partnerId },
  });
}
```

---

## 5. WebRTC Audio Talkback (Design Only — Not Phase 8)

For low-latency audio communication between session participants (live feedback, not stem streaming):

**Architecture:** Peer-to-peer via WebRTC. MIXHIVE acts only as a signaling server — never proxies audio.

**Signaling table** (Codex adds in a future migration):

```sql
CREATE TABLE IF NOT EXISTS collab_session_signals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid REFERENCES collab_sessions(id) ON DELETE CASCADE,
  from_id     uuid REFERENCES profiles(id),
  to_id       uuid REFERENCES profiles(id),
  signal_type text,   -- 'offer' | 'answer' | 'ice_candidate'
  payload     jsonb,
  created_at  timestamptz DEFAULT now(),
  ttl_expires timestamptz DEFAULT now() + interval '2 minutes'
);
-- Signals auto-expire; client polls this table or uses Realtime to detect new signals
CREATE INDEX ON collab_session_signals (session_id, to_id, created_at DESC);
```

**Media flow:**
1. Participant A clicks "Start talkback" → creates `offer` signal row
2. Participant B sees new signal row (via Supabase Realtime `INSERT`) → creates `answer` + exchanges `ice_candidates`
3. P2P audio channel established — MIXHIVE server is out of the loop from this point
4. `collab_session_signals` rows expire after 2 minutes (TTL)

**Budget:** Zero additional infra cost. Supabase's Realtime broadcast handles signaling. TURN server not needed for same-LAN or direct connections; add a free TURN provider (coturn, Cloudflare TURN) for NAT traversal if needed in Phase 9.

---

## 6. `StartMythicSessionModal` — Props Interface & API Calls

The existing `src/components/StartMythicSessionModal.tsx` is a non-functional stub. Here is the spec for wiring it up.

### Props

```typescript
interface StartMythicSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionCreated: (sessionId: string) => void;
  preselectedPartnerId?: string;   // optional: pre-fill partner from a Collab Cartographer suggestion
}
```

### Required API calls (in order)

1. **Create session:** `POST /api/mythic/sessions`
   ```typescript
   const { data: session } = await supabase
     .from('collab_sessions')
     .insert({ title, owner_id: userId, status: 'active', metadata: {} })
     .select('id')
     .single();
   ```

2. **Add participant (if preselected):** `POST /api/mythic/sessions/{id}/participants`
   ```typescript
   await supabase.from('collab_session_participants')
     .insert({ session_id: session.id, profile_id: partnerId, role: 'participant' });
   ```

3. **Subscribe to Realtime channels** (before redirect):
   ```typescript
   const presenceChannel = supabase.channel(`session:${session.id}:presence`);
   const stateChannel = supabase.channel(`session:${session.id}:state`);
   // ... attach handlers
   ```

4. **Redirect:** `router.push(\`/session/${session.id}\`)`

### View route

Add `/session/:id` to the React Router tree in `src/App.tsx`, pointing to a new `src/views/CollabSessionRoom.tsx`.

---

## 7. `MythicSessionRoom` — UI Panel Specification

The existing `src/components/MythicSessionRoom.tsx` stub needs these panels:

### Layout (desktop, 3-column)

```
┌─────────────────────────────────────────────────────────────────┐
│  Session title              [Invite]  [End session]  [Export →] │
├──────────────┬─────────────────────────────┬────────────────────┤
│  Presence    │    Tracklist Editor          │   Stems Panel      │
│  sidebar     │  (shared, version-locked)   │   (upload + list)  │
│              │                             │                    │
│  [avatars]   │  [drag-to-reorder rows]     │  [drag-drop zone]  │
│  [status]    │  [timestamp + title cols]   │  [stem list]       │
│  [cursor]    │                             │                    │
├──────────────┴─────────────────────────────┴────────────────────┤
│  Chat overlay (collapsible) — shared text channel               │
└─────────────────────────────────────────────────────────────────┘
```

### Panel → Realtime mapping

| Panel | Event type listened | Event type emitted |
|---|---|---|
| Presence sidebar | `presence` sync | `track()` on join/cursor move |
| Tracklist editor | `tracklist_updated` | `tracklist_updated` broadcast |
| Notes panel | `note_updated` | `note_updated` broadcast |
| Stems panel | `stem_added`, `stem_removed` | `stem_added`, `stem_removed` broadcast |
| Chat | `chat_message` | `chat_message` broadcast |
| Export button | (action) | `mix_exported` broadcast + API call |

### Conflict handling in UI

If the client receives a `tracklist_updated` with `version > local_version`, accept the remote version and show a subtle "Synced" toast. Never show a merge conflict dialog at MVP.

---

## Codex Handoff

**Migration 065:**
- Enable Supabase Realtime on `collab_sessions` (`ALTER PUBLICATION supabase_realtime ADD TABLE collab_sessions`)
- Add `collab_session_signals` table for WebRTC (design-only at this stage, can add now as a future hook)
- Add `session_produced_mix` to the allowed edge types in any edge-type CHECK constraint

**New API route:**
- `POST /api/mythic/sessions/{id}/participants` — adds a participant, RLS-guarded (only owner can add)
- `PATCH /api/mythic/sessions/{id}` — updates metadata, uses version-check optimistic lock (section 3)

## Claude Code Handoff

**Files to implement:**
- `src/components/StartMythicSessionModal.tsx` — wire up props interface + 3 API calls + redirect
- `src/views/CollabSessionRoom.tsx` — 3-column layout with 5 panels + Realtime subscriptions
- `src/App.tsx` — add `/session/:id` route

**Reuse:**
- `src/lib/websocket.ts` `RealtimeFeedManager` — study the channel subscription pattern; mirror it for session channels
- `src/components/ui/Modal.tsx` — base for StartMythicSessionModal
- `src/components/AudioPlayer.tsx` — stem preview player (reuse for stem list panel)
- Presence sidebar: pattern is similar to online indicators already in `src/components/Navbar.tsx`
