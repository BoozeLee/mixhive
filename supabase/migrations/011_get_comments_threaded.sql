-- Migration 011: single-query threaded-comments RPC
--
-- The previous getComments() in src/lib/api.ts fetched parent comments,
-- then issued one extra query per parent to fetch its replies — a textbook
-- 1+N pattern. For a popular mix with 50 comments this was 51 round trips.
--
-- This RPC returns the parents (paginated) with their replies aggregated
-- into a JSONB array, in one query. The client maps it 1:1 to the existing
-- `Comment` type without changing call-sites that consume the data.
--
-- Resolves: Phase 1.6 in plans/below-is-a-super-engineered-precious-babbage.md

begin;

create or replace function public.get_mix_comments(
  p_mix_id uuid,
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  id uuid,
  user_id uuid,
  mix_id uuid,
  parent_id uuid,
  body text,
  created_at timestamptz,
  updated_at timestamptz,
  user_username text,
  user_display_name text,
  user_avatar_url text,
  user_verified boolean,
  replies jsonb
)
language sql
stable
as $$
  with parents as (
    select c.*
    from public.comments c
    where c.mix_id = p_mix_id
      and c.parent_id is null
    order by c.created_at asc
    limit p_limit
    offset p_offset
  ),
  replies as (
    select
      c.parent_id,
      jsonb_agg(
        jsonb_build_object(
          'id',         c.id,
          'user_id',    c.user_id,
          'mix_id',     c.mix_id,
          'parent_id',  c.parent_id,
          'body',       c.body,
          'created_at', c.created_at,
          'updated_at', c.updated_at,
          'user', jsonb_build_object(
            'id',           rp.id,
            'username',     rp.username,
            'display_name', rp.display_name,
            'avatar_url',   rp.avatar_url,
            'verified',     rp.verified
          )
        )
        order by c.created_at asc
      ) as replies
    from public.comments c
    join public.profiles rp on rp.id = c.user_id
    where c.parent_id in (select id from parents)
    group by c.parent_id
  )
  select
    p.id,
    p.user_id,
    p.mix_id,
    p.parent_id,
    p.body,
    p.created_at,
    p.updated_at,
    pp.username        as user_username,
    pp.display_name    as user_display_name,
    pp.avatar_url      as user_avatar_url,
    pp.verified        as user_verified,
    coalesce(r.replies, '[]'::jsonb) as replies
  from parents p
  join public.profiles pp on pp.id = p.user_id
  left join replies r on r.parent_id = p.id
  order by p.created_at asc;
$$;

commit;
