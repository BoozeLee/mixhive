-- Migration 062: security-definer RPCs for Phase 2 agent use
--
-- Adds two new security-definer functions that Phase 2 agents call via
-- db.rpc() through ToolBridge (which enforces the allowlist):
--
--   find_candidate_promoters(p_genres, p_city, p_country, p_limit)
--     Returns active promoters whose genre overlap with p_genres is non-empty
--     and whose city/country matches the request. Used by booking_scout +
--     venue_fit agents.
--
--   get_artist_availability(p_profile_id, p_type)
--     Returns open availability slots for a given profile, optionally filtered
--     by type (gig, collab, etc.). Used by booking_scout + opportunity_match.
--
-- Resolves: Phase 2 data architecture — agent-accessible DB RPCs

begin;

-- =====================================================================
-- find_candidate_promoters
-- =====================================================================

create or replace function public.find_candidate_promoters(
  p_genres  text[],
  p_city    text    default null,
  p_country text    default 'BE',
  p_limit   integer default 20
)
returns table (
  id            uuid,
  name          text,
  city          text,
  country       text,
  genres        text[],
  contact_email text,
  website_url   text,
  is_verified   boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select
    p.id,
    p.name,
    p.city,
    p.country,
    p.genres,
    p.contact_email,
    p.website_url,
    p.is_verified
  from public.promoters p
  where
    p.is_active = true
    and (p_country is null or p.country = p_country)
    and (p_city is null or lower(p.city) = lower(p_city))
    and (
      p_genres is null
      or array_length(p_genres, 1) is null
      or p.genres && p_genres
    )
  order by p.is_verified desc, p.name
  limit least(p_limit, 100);
$$;

revoke all on function public.find_candidate_promoters(text[], text, text, integer) from public;
grant execute on function public.find_candidate_promoters(text[], text, text, integer)
  to service_role, authenticated;

-- =====================================================================
-- get_artist_availability
-- =====================================================================

create or replace function public.get_artist_availability(
  p_profile_id uuid,
  p_type       text default null
)
returns table (
  id                bigint,
  availability_type text,
  date_from         date,
  date_to           date,
  timezone          text,
  notes             text,
  is_open           boolean,
  recurring         boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select
    a.id,
    a.availability_type,
    a.date_from,
    a.date_to,
    a.timezone,
    a.notes,
    a.is_open,
    a.recurring
  from public.availability a
  where
    a.user_id  = p_profile_id
    and a.is_open  = true
    and (p_type is null or a.availability_type = p_type)
    and (a.date_to is null or a.date_to >= current_date)
  order by a.date_from asc nulls last;
$$;

revoke all on function public.get_artist_availability(uuid, text) from public;
grant execute on function public.get_artist_availability(uuid, text)
  to service_role, authenticated;

-- Resolves: Phase 2 data architecture — agent-accessible DB RPCs
commit;
