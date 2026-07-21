-- Migration 118: fire notifications for events and live rooms
--
-- Migration 114 widened notifications.type to allow the event/live-room types and
-- src/lib/notificationPresentation.ts renders all of them, but nothing anywhere
-- ever inserted one — the whole feature was display logic for events that never
-- occurred. This wires the missing half.
--
-- These must be triggers, not application code: RLS is enabled on notifications
-- with no INSERT policy, so a route using the caller's JWT cannot write one. Every
-- existing notification in this app is produced by a security-definer trigger.
--
-- Numbered 118 because 117 is taken by an in-flight mixes_visibility migration.
-- Duplicate version prefixes are not cosmetic here: schema_migrations keys on the
-- prefix, and collisions at 001 and 040 previously made the whole chain
-- unapplyable.
--
-- Not included, deliberately: live_room_invite (needs an invite table that does
-- not exist) and event_reminder (needs a scheduler). Leaving those dead is honest;
-- half-wiring them is not.
--
-- Preference gating is intentionally absent, matching every existing trigger:
-- notifications are inserted unconditionally and notification_preferences is
-- consulted downstream at push-delivery time.
--
-- Resolves: Phase 17.1 Slice 3 (notification types were dead code)

begin;

-- ── rsvp_confirmed ───────────────────────────────────────────────────────────
-- Notifies the organizer that someone is coming.
--
-- The RSVP route upserts on (event_id, user_id), so this fires on INSERT and on
-- UPDATE. Without the old-status guard, every repeat upsert — including a no-op
-- re-RSVP — would notify the organizer again.
create or replace function public.handle_rsvp_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> 'going' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status is not distinct from 'going' then
    return new;
  end if;

  insert into public.notifications (user_id, type, actor_id, data)
  select
    e.organizer_id,
    'rsvp_confirmed',
    new.user_id,
    jsonb_build_object('event_id', e.id)
  from public.events e
  where e.id = new.event_id
    and e.organizer_id <> new.user_id;  -- organizers don't notify themselves

  return new;
end;
$$;

drop trigger if exists trg_rsvp_notification on public.event_rsvps;
create trigger trg_rsvp_notification
  after insert or update of status on public.event_rsvps
  for each row
  execute function public.handle_rsvp_notification();

-- ── event_update / event_cancelled ───────────────────────────────────────────
-- Both reach the database through the same `update events set …`, so one trigger
-- distinguishes them by inspecting the status transition.
--
-- The changed-field check matters: every PATCH also bumps updated_at, so without
-- it a cosmetic edit would notify every attendee.
create or replace function public.handle_event_change_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
  v_statuses text[];
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    v_type := 'event_cancelled';
    v_statuses := array['going', 'maybe'];
  elsif new.status = 'published'
        and (new.starts_at        is distinct from old.starts_at
          or new.ends_at          is distinct from old.ends_at
          or new.venue_name       is distinct from old.venue_name
          or new.venue_address    is distinct from old.venue_address
          or new.cover_image_url  is distinct from old.cover_image_url) then
    v_type := 'event_update';
    v_statuses := array['going'];
  else
    return new;
  end if;

  insert into public.notifications (user_id, type, actor_id, data)
  select
    r.user_id,
    v_type,
    new.organizer_id,
    jsonb_build_object('event_id', new.id)
  from public.event_rsvps r
  where r.event_id = new.id
    and r.status = any (v_statuses)
    and r.user_id <> new.organizer_id;

  return new;
end;
$$;

drop trigger if exists trg_event_change_notification on public.events;
create trigger trg_event_change_notification
  after update on public.events
  for each row
  execute function public.handle_event_change_notification();

-- ── live_room_started ────────────────────────────────────────────────────────
-- Mirrors the app's own waiting -> live transition. Notifies everyone currently
-- in the room except the host who started it.
create or replace function public.handle_live_room_started_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, actor_id, data)
  select
    p.user_id,
    'live_room_started',
    new.host_id,
    jsonb_build_object('room_id', new.id)
  from public.live_room_participants p
  where p.room_id = new.id
    and p.left_at is null
    and p.user_id <> new.host_id;

  return new;
end;
$$;

drop trigger if exists trg_live_room_started_notification on public.live_rooms;
create trigger trg_live_room_started_notification
  after update of status on public.live_rooms
  for each row
  when (new.status = 'live' and old.status is distinct from 'live')
  execute function public.handle_live_room_started_notification();

-- These are trigger functions only — never called directly by a client.
revoke execute on function public.handle_rsvp_notification() from public;
revoke execute on function public.handle_event_change_notification() from public;
revoke execute on function public.handle_live_room_started_notification() from public;

commit;
