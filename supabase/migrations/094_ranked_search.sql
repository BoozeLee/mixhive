-- Migration 094: Public relevance-ranked search across mixes, artists, and scenes.

begin;

create index if not exists idx_profiles_search_username_trgm
  on public.profiles using gin (lower(username) gin_trgm_ops);
create index if not exists idx_profiles_search_display_name_trgm
  on public.profiles using gin (lower(coalesce(display_name, '')) gin_trgm_ops);
create index if not exists idx_mixes_search_title_trgm
  on public.mixes using gin (lower(title) gin_trgm_ops)
  where published = true;
create index if not exists idx_scenes_search_name_trgm
  on public.scenes using gin (lower(name) gin_trgm_ops)
  where is_active = true;

create or replace function public.search_ranked_profiles(
  p_query text,
  p_genre text default null,
  p_location text default null,
  p_limit int default 20,
  p_offset int default 0
)
returns table (item jsonb, relevance real, total_count bigint)
language sql stable security definer set search_path = public as $$
  with candidates as (
    select p.*,
      greatest(
        case when lower(p.username) = lower(trim(p_query)) then 1.0 else 0 end,
        case when lower(coalesce(p.display_name, '')) = lower(trim(p_query)) then 0.98 else 0 end,
        case when lower(p.username) like lower(trim(p_query)) || '%' then 0.92 else 0 end,
        case when lower(coalesce(p.display_name, '')) like lower(trim(p_query)) || '%' then 0.90 else 0 end,
        case when lower(p.username) like '%' || lower(trim(p_query)) || '%' then 0.82 else 0 end,
        case when lower(coalesce(p.display_name, '')) like '%' || lower(trim(p_query)) || '%' then 0.80 else 0 end,
        case when lower(coalesce(p.bio, '')) like '%' || lower(trim(p_query)) || '%' then 0.58 else 0 end,
        case when lower(array_to_string(coalesce(p.genres, '{}'), ' ')) like '%' || lower(trim(p_query)) || '%' then 0.68 else 0 end,
        case when lower(coalesce(p.location, '')) like '%' || lower(trim(p_query)) || '%' then 0.68 else 0 end,
        similarity(lower(p.username), lower(trim(p_query))) * 0.75,
        similarity(lower(coalesce(p.display_name, '')), lower(trim(p_query))) * 0.72,
        similarity(lower(coalesce(p.bio, '')), lower(trim(p_query))) * 0.45,
        similarity(lower(array_to_string(coalesce(p.genres, '{}'), ' ')), lower(trim(p_query))) * 0.55,
        similarity(lower(coalesce(p.location, '')), lower(trim(p_query))) * 0.55,
        word_similarity(lower(trim(p_query)), lower(concat_ws(' ', p.username, p.display_name, p.bio, p.location, array_to_string(coalesce(p.genres, '{}'), ' ')))) * 0.72
      )::real as rank
    from public.profiles p
    where coalesce(p.onboarding_complete, false)
      and (p_genre is null or p.genres @> array[p_genre])
      and (p_location is null or p.location ilike '%' || p_location || '%')
  ), matched as (
    select * from candidates where rank >= 0.18
  )
  select jsonb_build_object(
      'id', m.id, 'username', m.username, 'display_name', m.display_name,
      'avatar_url', m.avatar_url, 'banner_url', m.banner_url, 'bio', m.bio,
      'location', m.location, 'website', m.website, 'genres', m.genres,
      'social_links', m.social_links, 'is_dj', m.is_dj, 'verified', m.verified,
      'onboarding_complete', m.onboarding_complete, 'xp', m.xp,
      'reputation_score', m.reputation_score, 'created_at', m.created_at,
      'updated_at', m.updated_at
    ), m.rank, count(*) over()
  from matched m
  order by m.rank desc, coalesce(m.verified, false) desc,
    coalesce(m.reputation_score, 0) desc, m.created_at desc
  limit least(greatest(p_limit, 1), 20) offset greatest(p_offset, 0);
$$;

create or replace function public.search_ranked_scenes(
  p_query text,
  p_genre text default null,
  p_location text default null,
  p_limit int default 20,
  p_offset int default 0
)
returns table (item jsonb, relevance real, total_count bigint)
language sql stable security definer set search_path = public as $$
  with candidates as (
    select s.*,
      greatest(
        case when lower(s.name) = lower(trim(p_query)) then 1.0 else 0 end,
        case when lower(s.slug) = lower(trim(p_query)) then 0.98 else 0 end,
        case when lower(s.name) like lower(trim(p_query)) || '%' then 0.92 else 0 end,
        case when lower(s.slug) like lower(trim(p_query)) || '%' then 0.90 else 0 end,
        case when lower(s.name) like '%' || lower(trim(p_query)) || '%' then 0.82 else 0 end,
        case when lower(coalesce(s.description, '')) like '%' || lower(trim(p_query)) || '%' then 0.58 else 0 end,
        case when lower(coalesce(s.genre, '')) like '%' || lower(trim(p_query)) || '%' then 0.70 else 0 end,
        case when lower(concat_ws(' ', s.city, s.country)) like '%' || lower(trim(p_query)) || '%' then 0.70 else 0 end,
        similarity(lower(s.name), lower(trim(p_query))) * 0.75,
        similarity(lower(s.slug), lower(trim(p_query))) * 0.70,
        similarity(lower(coalesce(s.description, '')), lower(trim(p_query))) * 0.45,
        similarity(lower(coalesce(s.genre, '')), lower(trim(p_query))) * 0.60,
        similarity(lower(concat_ws(' ', s.city, s.country)), lower(trim(p_query))) * 0.60,
        word_similarity(lower(trim(p_query)), lower(concat_ws(' ', s.name, s.slug, s.description, s.genre, s.city, s.country))) * 0.72
      )::real as rank
    from public.scenes s
    where s.is_active
      and (p_genre is null or s.genre ilike p_genre)
      and (p_location is null or concat_ws(' ', s.city, s.country) ilike '%' || p_location || '%')
  ), matched as (
    select * from candidates where rank >= 0.18
  )
  select jsonb_build_object(
      'id', m.id, 'slug', m.slug, 'name', m.name, 'city', m.city,
      'country', m.country, 'genre', m.genre, 'description', m.description,
      'hero_image_url', m.hero_image_url
    ), m.rank, count(*) over()
  from matched m
  order by m.rank desc, m.name
  limit least(greatest(p_limit, 1), 20) offset greatest(p_offset, 0);
$$;

create or replace function public.search_ranked_mixes(
  p_query text,
  p_genre text default null,
  p_location text default null,
  p_limit int default 20,
  p_offset int default 0
)
returns table (item jsonb, relevance real, total_count bigint)
language sql stable security definer set search_path = public as $$
  with candidates as (
    select m.*, g.name as genre_name, p.username as dj_username,
      p.display_name as dj_display_name, p.avatar_url as dj_avatar_url,
      greatest(
        case when lower(m.title) = lower(trim(p_query)) then 1.0 else 0 end,
        case when lower(m.title) like lower(trim(p_query)) || '%' then 0.92 else 0 end,
        case when lower(m.title) like '%' || lower(trim(p_query)) || '%' then 0.84 else 0 end,
        case when lower(coalesce(m.description, '')) like '%' || lower(trim(p_query)) || '%' then 0.58 else 0 end,
        case when lower(array_to_string(coalesce(m.tags, '{}'), ' ')) like '%' || lower(trim(p_query)) || '%' then 0.70 else 0 end,
        case when lower(coalesce(g.name, '')) like '%' || lower(trim(p_query)) || '%' then 0.72 else 0 end,
        case when lower(coalesce(p.username, '')) like '%' || lower(trim(p_query)) || '%' then 0.72 else 0 end,
        case when lower(coalesce(p.display_name, '')) like '%' || lower(trim(p_query)) || '%' then 0.72 else 0 end,
        similarity(lower(m.title), lower(trim(p_query))) * 0.78,
        similarity(lower(coalesce(m.description, '')), lower(trim(p_query))) * 0.45,
        similarity(lower(array_to_string(coalesce(m.tags, '{}'), ' ')), lower(trim(p_query))) * 0.58,
        similarity(lower(coalesce(g.name, '')), lower(trim(p_query))) * 0.62,
        similarity(lower(coalesce(p.username, '')), lower(trim(p_query))) * 0.62,
        similarity(lower(coalesce(p.display_name, '')), lower(trim(p_query))) * 0.62,
        word_similarity(lower(trim(p_query)), lower(concat_ws(' ', m.title, m.description, array_to_string(coalesce(m.tags, '{}'), ' '), g.name, p.username, p.display_name))) * 0.72
      )::real as rank
    from public.mixes m
    join public.profiles p on p.id = m.dj_id
    left join public.genres g on g.id = m.genre_id
    where m.published
      and (p_genre is null or g.name ilike p_genre)
      and (p_location is null or p.location ilike '%' || p_location || '%')
  ), matched as (
    select * from candidates where rank >= 0.18
  )
  select (to_jsonb(m) - 'rank' - 'genre_name' - 'dj_username' - 'dj_display_name' - 'dj_avatar_url')
      || jsonb_build_object(
        'genre_name', m.genre_name, 'dj_username', m.dj_username,
        'dj_display_name', m.dj_display_name, 'dj_avatar_url', m.dj_avatar_url
      ),
    m.rank, count(*) over()
  from matched m
  order by m.rank desc, (coalesce(m.play_count, 0) + coalesce(m.like_count, 0) * 2) desc,
    m.created_at desc
  limit least(greatest(p_limit, 1), 20) offset greatest(p_offset, 0);
$$;

revoke all on function public.search_ranked_profiles(text,text,text,int,int) from public;
revoke all on function public.search_ranked_mixes(text,text,text,int,int) from public;
revoke all on function public.search_ranked_scenes(text,text,text,int,int) from public;
grant execute on function public.search_ranked_profiles(text,text,text,int,int) to anon, authenticated;
grant execute on function public.search_ranked_mixes(text,text,text,int,int) to anon, authenticated;
grant execute on function public.search_ranked_scenes(text,text,text,int,int) to anon, authenticated;

commit;
