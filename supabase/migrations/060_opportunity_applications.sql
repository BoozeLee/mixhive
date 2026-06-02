-- Migration 060: opportunity_applications — extend opportunity_saves
--
-- opportunity_saves currently tracks saves and drafts with a basic status enum.
-- opportunity_match and grant_assistant agents need structured outcome tracking:
-- when did the user apply, what was the outcome, and any response notes.
-- Adds columns to the existing table rather than creating a new one.
--
-- Resolves: Phase 2 data architecture — structured application outcome tracking

begin;

alter table public.opportunity_saves
  add column if not exists applied_at     timestamptz,
  add column if not exists outcome        text
                             check (outcome is null or outcome in (
                               'pending', 'accepted', 'rejected', 'withdrawn'
                             )),
  add column if not exists outcome_date   date,
  add column if not exists response_notes text;

-- Set default outcome for existing 'applied' rows
update public.opportunity_saves
set outcome = 'pending'
where status = 'applied' and outcome is null;

-- Resolves: Phase 2 data architecture — structured application outcome tracking
commit;
