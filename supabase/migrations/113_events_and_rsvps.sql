-- Migration 113: Events & RSVPs
-- Rave/party/meetup listings with RSVP system.

BEGIN;

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  scene_id UUID REFERENCES scenes(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (length(title) > 0 AND length(title) <= 200),
  description TEXT CHECK (length(description) <= 5000),
  venue_name TEXT CHECK (length(venue_name) <= 200),
  venue_address TEXT CHECK (length(venue_address) <= 500),
  cover_image_url TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  max_attendees INT CHECK (max_attendees IS NULL OR max_attendees > 0),
  is_free BOOLEAN NOT NULL DEFAULT true,
  ticket_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'cancelled', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_events_organizer ON events(organizer_id);
CREATE INDEX IF NOT EXISTS idx_events_scene ON events(scene_id) WHERE scene_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_starts ON events(starts_at) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status) WHERE status IN ('published', 'draft');

CREATE TABLE IF NOT EXISTS event_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'going' CHECK (status IN ('going', 'maybe', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_rsvps_event ON event_rsvps(event_id) WHERE status != 'cancelled';
CREATE INDEX IF NOT EXISTS idx_event_rsvps_user ON event_rsvps(user_id) WHERE status != 'cancelled';

-- RLS: events
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published events visible to everyone"
  ON events FOR SELECT
  USING (status = 'published' OR status = 'completed' OR status = 'cancelled');

CREATE POLICY "Organizers can see own draft events"
  ON events FOR SELECT
  USING (auth.uid() = organizer_id);

CREATE POLICY "Authenticated users can create events"
  ON events FOR INSERT
  WITH CHECK (auth.uid() = organizer_id);

CREATE POLICY "Organizer can update own events"
  ON events FOR UPDATE
  USING (auth.uid() = organizer_id)
  WITH CHECK (auth.uid() = organizer_id);

CREATE POLICY "Organizer can delete own events"
  ON events FOR DELETE
  USING (auth.uid() = organizer_id);

-- RLS: event_rsvps
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "RSVPs visible for published events"
  ON event_rsvps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_rsvps.event_id
        AND (events.status IN ('published', 'completed') OR events.organizer_id = auth.uid())
    )
  );

CREATE POLICY "Authenticated users can RSVP"
  ON event_rsvps FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own RSVP"
  ON event_rsvps FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can cancel own RSVP"
  ON event_rsvps FOR DELETE
  USING (auth.uid() = user_id);

-- updated_at trigger for events
CREATE OR REPLACE FUNCTION update_event_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_events_updated_at ON events;
CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_event_updated_at();

-- updated_at trigger for event_rsvps
DROP TRIGGER IF EXISTS trg_event_rsvps_updated_at ON event_rsvps;
CREATE TRIGGER trg_event_rsvps_updated_at
  BEFORE UPDATE ON event_rsvps
  FOR EACH ROW
  EXECUTE FUNCTION update_event_updated_at();

COMMIT;
