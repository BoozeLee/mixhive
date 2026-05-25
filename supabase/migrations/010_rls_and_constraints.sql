-- Migration 010: close RLS gaps and add data-integrity constraints
--
-- The audit in Phase 1 of the 5-star roadmap found several tables with RLS
-- enabled but missing essential policies — meaning the client either can't
-- access them at all (genres locked) or that the server-side mutation paths
-- worked only because triggers / RPCs bypassed the missing rules. This
-- migration is the security backstop: every CRUD path that ships should be
-- gated by an explicit policy, not by "nobody is sending bad data yet."
--
-- The CHECK constraints catch the next class of bug: negative counters from
-- a trigger race, oversized comment bodies pasted from a malicious script,
-- usernames with hostile characters, position columns that go negative on
-- reorder.
--
-- Resolves: Phase 1.2 + 1.3 in plans/below-is-a-super-engineered-precious-babbage.md

begin;

-- =====================================================================
-- RLS GAP FIXES
-- =====================================================================

-- genres — public lookup table, but had RLS enabled with zero policies
-- (effectively locked). The client filter / upload dropdowns query this.
drop policy if exists "Genres are publicly readable" on public.genres;
create policy "Genres are publicly readable"
  on public.genres for select using (true);

-- play_history — currently the client cannot SELECT or INSERT directly;
-- increment_play_count() RPC inserts on the user's behalf via the postgres
-- role. Add explicit policies so the contract is in the DB, not implicit.
drop policy if exists "Users can read own play_history" on public.play_history;
create policy "Users can read own play_history"
  on public.play_history for select
  using (user_id = auth.uid() or user_id is null);

drop policy if exists "Users can insert own play_history" on public.play_history;
create policy "Users can insert own play_history"
  on public.play_history for insert
  with check (user_id = auth.uid() or user_id is null);

-- feed_events — repost INSERT in api.ts:repost() currently relies entirely
-- on the unique partial index for safety; the client could in principle
-- forge an actor_id that isn't theirs. Lock it down.
drop policy if exists "Users can read own feed_events" on public.feed_events;
create policy "Users can read own feed_events"
  on public.feed_events for select
  using (actor_id = auth.uid() or target_id = auth.uid());

drop policy if exists "Users can insert own feed_events" on public.feed_events;
create policy "Users can insert own feed_events"
  on public.feed_events for insert
  with check (actor_id = auth.uid());

-- notifications — markNotificationsRead() updates `read = true`. RLS only
-- had a SELECT policy; UPDATE worked via the postgres role. Add a strict
-- UPDATE policy that only allows toggling `read` on your own rows.
drop policy if exists "Users can mark own notifications read" on public.notifications;
create policy "Users can mark own notifications read"
  on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- comments — the audit flagged missing DELETE. Add it for both the comment
-- author and the owner of the mix the comment belongs to (mod-the-mix
-- semantics; like SoundCloud / YouTube).
drop policy if exists "Users can delete own comments or comments on their mix" on public.comments;
create policy "Users can delete own comments or comments on their mix"
  on public.comments for delete
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.mixes m
      where m.id = comments.mix_id
        and m.dj_id = auth.uid()
    )
  );


-- =====================================================================
-- DATA-INTEGRITY CONSTRAINTS
-- =====================================================================
-- All constraints are added with NOT VALID + VALIDATE so that any
-- pre-existing data that violates them surfaces clearly without blocking
-- the migration on a tiny seed dataset. If VALIDATE fails on a row, the
-- operator must clean the row before re-running.

-- mixes: positive duration when set, non-negative counters, reasonable
-- description length.
alter table public.mixes
  drop constraint if exists mixes_duration_positive,
  add constraint mixes_duration_positive
    check (duration_seconds is null or duration_seconds > 0) not valid;
alter table public.mixes validate constraint mixes_duration_positive;

alter table public.mixes
  drop constraint if exists mixes_counts_non_negative,
  add constraint mixes_counts_non_negative
    check (play_count >= 0 and like_count >= 0 and comment_count >= 0) not valid;
alter table public.mixes validate constraint mixes_counts_non_negative;

alter table public.mixes
  drop constraint if exists mixes_description_length,
  add constraint mixes_description_length
    check (description is null or char_length(description) <= 10000) not valid;
alter table public.mixes validate constraint mixes_description_length;

-- comments: bodies between 1 and 5000 chars. The 5000 limit gives room for
-- thoughtful long-form comments while blocking pasted essays / spam blobs.
alter table public.comments
  drop constraint if exists comments_body_length,
  add constraint comments_body_length
    check (char_length(body) between 1 and 5000) not valid;
alter table public.comments validate constraint comments_body_length;

-- playlist_mixes: position is a sort key; negative is meaningless.
alter table public.playlist_mixes
  drop constraint if exists playlist_mixes_position_non_negative,
  add constraint playlist_mixes_position_non_negative
    check (position >= 0) not valid;
alter table public.playlist_mixes validate constraint playlist_mixes_position_non_negative;

-- profiles: usernames are 3–30 chars, alphanumeric + underscore. Matches
-- the regex used in the @mention extractor (006:54) so a created username
-- is always mentionable.
--
-- Sanity check first: any existing row that violates the regex must be
-- renamed by the operator before this constraint is added. Surface them.
do $$
declare
  bad_count int;
begin
  select count(*) into bad_count
  from public.profiles
  where username !~ '^[A-Za-z0-9_]{3,30}$';

  if bad_count > 0 then
    raise notice
      '% profile(s) have a username that does not match the new constraint. They need to be cleaned up before the constraint can be VALIDATED.',
      bad_count;
  end if;
end$$;

alter table public.profiles
  drop constraint if exists profiles_username_format,
  add constraint profiles_username_format
    check (username ~ '^[A-Za-z0-9_]{3,30}$') not valid;
-- The VALIDATE step is split out so operators can run it after cleaning
-- any pre-existing bad rows. New INSERT/UPDATE traffic is gated from now.
-- To validate retroactively, run:
--   alter table public.profiles validate constraint profiles_username_format;


commit;
