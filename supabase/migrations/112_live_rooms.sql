-- Migration 112: Live Collaboration Rooms
-- Real-time DJ sessions with presence, chat, and waveform sync placeholders.

BEGIN;

-- Live rooms: a session that multiple users can join
CREATE TABLE IF NOT EXISTS live_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  scene_id UUID REFERENCES scenes(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Untitled Session',
  description TEXT,
  max_participants INT NOT NULL DEFAULT 8 CHECK (max_participants BETWEEN 2 AND 64),
  is_public BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'live', 'ended')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_rooms_status ON live_rooms(status) WHERE status != 'ended';
CREATE INDEX IF NOT EXISTS idx_live_rooms_host ON live_rooms(host_id);
CREATE INDEX IF NOT EXISTS idx_live_rooms_scene ON live_rooms(scene_id) WHERE scene_id IS NOT NULL;

-- Participants in a live room
CREATE TABLE IF NOT EXISTS live_room_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES live_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'listener' CHECK (role IN ('host', 'dj', 'listener')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ,
  UNIQUE(room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_lrp_room ON live_room_participants(room_id) WHERE left_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_lrp_user ON live_room_participants(user_id) WHERE left_at IS NULL;

-- Chat messages within a live room
CREATE TABLE IF NOT EXISTS live_room_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES live_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (length(content) > 0 AND length(content) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lrm_room_time ON live_room_messages(room_id, created_at DESC);

-- Enable realtime for presence and chat
ALTER PUBLICATION supabase_realtime ADD TABLE live_room_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE live_room_messages;

-- Membership check used by the policies below.
--
-- SECURITY DEFINER is load-bearing, not incidental: it runs with the owner's
-- rights and therefore bypasses RLS on live_room_participants. Without it,
-- a policy on live_room_participants that queries live_room_participants
-- re-enters itself and Postgres raises 42P17 (infinite recursion detected in
-- policy for relation). The same helper also lets live_rooms consult
-- membership without creating a live_rooms <-> live_room_participants cycle.
CREATE OR REPLACE FUNCTION public.is_live_room_participant(
  p_room_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.live_room_participants
    WHERE room_id = p_room_id
      AND user_id = p_user_id
      AND left_at IS NULL
  );
$$;

-- RLS: live_rooms
ALTER TABLE live_rooms ENABLE ROW LEVEL SECURITY;

-- Private rooms must stay readable by the people entitled to be in them.
-- A public-only USING clause would hide a private room from its own host the
-- moment it was created, making is_public = false dead functionality.
CREATE POLICY "Rooms visible to public, host, and participants"
  ON live_rooms FOR SELECT
  USING (
    is_public = true
    OR status = 'ended'
    OR auth.uid() = host_id
    OR public.is_live_room_participant(id, auth.uid())
  );

CREATE POLICY "Authenticated users can create rooms"
  ON live_rooms FOR INSERT
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Host can update own room"
  ON live_rooms FOR UPDATE
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Host can delete own room"
  ON live_rooms FOR DELETE
  USING (auth.uid() = host_id);

-- RLS: live_room_participants
ALTER TABLE live_room_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants visible for active rooms"
  ON live_room_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM live_rooms
      WHERE live_rooms.id = live_room_participants.room_id
        AND (live_rooms.is_public = true
             OR live_rooms.status = 'ended'
             OR live_rooms.host_id = auth.uid()
             OR public.is_live_room_participant(live_rooms.id, auth.uid()))
    )
  );

CREATE POLICY "Authenticated users can join rooms"
  ON live_room_participants FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM live_rooms
      WHERE live_rooms.id = room_id
        AND live_rooms.status IN ('waiting', 'live')
        AND (
          SELECT COUNT(*)::int FROM live_room_participants
          WHERE room_id = live_rooms.id AND left_at IS NULL
        ) < live_rooms.max_participants
    )
  );

CREATE POLICY "Users can leave rooms"
  ON live_room_participants FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can be removed by host"
  ON live_room_participants FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM live_rooms
      WHERE live_rooms.id = live_room_participants.room_id
        AND live_rooms.host_id = auth.uid()
    )
  );

CREATE POLICY "Host can remove participants"
  ON live_room_participants FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM live_rooms
      WHERE live_rooms.id = live_room_participants.room_id
        AND live_rooms.host_id = auth.uid()
    )
  );

-- RLS: live_room_messages
ALTER TABLE live_room_messages ENABLE ROW LEVEL SECURITY;

-- Uses the helper rather than an inline EXISTS so evaluating a message does not
-- cascade through the live_room_participants -> live_rooms policy chain on
-- every row.
CREATE POLICY "Messages visible for room participants"
  ON live_room_messages FOR SELECT
  USING (public.is_live_room_participant(room_id, auth.uid()));

CREATE POLICY "Participants can send messages"
  ON live_room_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_live_room_participant(room_id, auth.uid())
  );

-- updated_at trigger for live_rooms
CREATE OR REPLACE FUNCTION update_live_room_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_live_rooms_updated_at ON live_rooms;
CREATE TRIGGER trg_live_rooms_updated_at
  BEFORE UPDATE ON live_rooms
  FOR EACH ROW
  EXECUTE FUNCTION update_live_room_updated_at();

COMMIT;
