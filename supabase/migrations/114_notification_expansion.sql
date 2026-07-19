-- Migration 114: Notification Type Expansion
-- Adds live room and event notification types.

BEGIN;

-- Drop the existing CHECK constraint and recreate with expanded types
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    -- existing types
    'like', 'follow', 'comment', 'reply', 'mix_upload', 'mention',
    'buzz_like', 'repost', 'verification', 'message', 'agent_notification',
    'agent_purchased', 'agent_sale', 'gear_sale', 'gear_shipped',
    'gear_delivered', 'gear_confirmed', 'gear_payout', 'gear_refunded',
    'gear_disputed', 'earnings_paid', 'quest_complete', 'beehive_publish',
    -- new: live room types
    'live_room_invite', 'live_room_started', 'live_room_ended',
    -- new: event types
    'event_created', 'event_reminder', 'event_update', 'event_cancelled',
    'rsvp_confirmed'
  ));

-- Index for the new notification types
CREATE INDEX IF NOT EXISTS idx_notifications_user_type ON notifications(user_id, type, read)
  WHERE type IN ('live_room_invite', 'live_room_started', 'event_reminder', 'event_update', 'rsvp_confirmed');

COMMIT;
