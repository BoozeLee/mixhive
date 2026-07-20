-- Migration 089: XP and Reputation System
--
-- Adds XP, Level, and Reputation to profiles.
-- Wires a trigger to update total_xp whenever a collab_quest_review is recorded.
--
-- Resolves: Phase 16 — Reputation system fully wired

begin;

-- 1. Add columns to profiles
alter table public.profiles
  add column if not exists xp integer not null default 0,
  add column if not exists level integer not null default 1,
  add column if not exists reputation_score numeric(4,2) not null default 5.0;

-- 2. Function to calculate level from XP
-- Level = floor(sqrt(xp / 100)) + 1  (simple quadratic curve)
create or replace function public.calculate_level(p_xp integer)
returns integer as $$
begin
  return floor(sqrt(p_xp / 100.0)) + 1;
end;
$$ language plpgsql immutable;

-- 3. Trigger function to sync XP and Reputation
create or replace function public.on_quest_review_sync_xp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_xp integer;
  v_avg_rep numeric(4,2);
begin
  -- Calculate total XP from all reviews for this user
  select coalesce(sum(xp_awarded), 0) into v_total_xp
  from public.collab_quest_reviews
  where reviewee_profile_id = new.reviewee_profile_id;

  -- Calculate average reputation (craft + collab + reliability) / 3
  select coalesce(
    avg((craft_rating + collaboration_rating + reliability_rating) / 3.0),
    5.0
  ) into v_avg_rep
  from public.collab_quest_reviews
  where reviewee_profile_id = new.reviewee_profile_id
    and craft_rating is not null;

  -- Update profile
  update public.profiles
  set 
    xp = v_total_xp,
    level = public.calculate_level(v_total_xp),
    reputation_score = v_avg_rep,
    updated_at = now()
  where id = new.reviewee_profile_id;

  return new;
end;
$$;

-- 4. Create trigger
drop trigger if exists tr_sync_xp_on_review on public.collab_quest_reviews;
create trigger tr_sync_xp_on_review
  after insert or update on public.collab_quest_reviews
  for each row execute function public.on_quest_review_sync_xp();

-- 5. Backfill existing XP if any
update public.profiles p
set 
  xp = sub.total_xp,
  -- sum(integer) yields bigint, and calculate_level takes integer; Postgres
  -- will not implicitly narrow it for function resolution (42883).
  level = public.calculate_level(sub.total_xp::int),
  reputation_score = sub.avg_rep
from (
  select 
    reviewee_profile_id,
    sum(xp_awarded) as total_xp,
    avg((coalesce(craft_rating, 5) + coalesce(collaboration_rating, 5) + coalesce(reliability_rating, 5)) / 3.0) as avg_rep
  from public.collab_quest_reviews
  group by reviewee_profile_id
) sub
where p.id = sub.reviewee_profile_id;

commit;
