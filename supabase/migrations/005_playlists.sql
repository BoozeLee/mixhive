-- Mix Hive v5 - Playlists
-- Run after 004_feed_algorithm.sql

-- ===== PLAYLISTS =====

create table if not exists public.playlists (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  artwork_url text,
  is_public boolean default true,
  mix_count int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_playlists_owner on public.playlists(owner_id);
create index idx_playlists_public on public.playlists(is_public) where is_public = true;

-- ===== PLAYLIST MIXES (join table with ordering) =====

create table if not exists public.playlist_mixes (
  id uuid primary key default uuid_generate_v4(),
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  mix_id uuid not null references public.mixes(id) on delete cascade,
  position int not null default 0,
  added_at timestamptz default now(),
  unique (playlist_id, mix_id),
  unique (playlist_id, position)
);

create index idx_playlist_mixes_playlist on public.playlist_mixes(playlist_id);
create index idx_playlist_mixes_mix on public.playlist_mixes(mix_id);

-- ===== ROW LEVEL SECURITY =====

alter table public.playlists enable row level security;
alter table public.playlist_mixes enable row level security;

create policy "Public playlists are readable"
  on public.playlists for select
  using (is_public = true or owner_id = auth.uid());

create policy "Users can create playlists"
  on public.playlists for insert
  with check (owner_id = auth.uid());

create policy "Users can update own playlists"
  on public.playlists for update
  using (owner_id = auth.uid());

create policy "Users can delete own playlists"
  on public.playlists for delete
  using (owner_id = auth.uid());

create policy "Playlist mixes are readable with playlist"
  on public.playlist_mixes for select
  using (
    exists (
      select 1 from public.playlists
      where id = playlist_id
      and (is_public = true or owner_id = auth.uid())
    )
  );

create policy "Playlist owners can manage mixes"
  on public.playlist_mixes for insert
  with check (
    exists (
      select 1 from public.playlists
      where id = playlist_id and owner_id = auth.uid()
    )
  );

create policy "Playlist owners can remove mixes"
  on public.playlist_mixes for delete
  using (
    exists (
      select 1 from public.playlists
      where id = playlist_id and owner_id = auth.uid()
    )
  );

-- ===== TRIGGER: UPDATE MIX COUNT =====

create or replace function public.update_playlist_mix_count()
returns trigger
language plpgsql
security definer
as $$
begin
  if tg_op = 'INSERT' then
    update public.playlists set mix_count = mix_count + 1, updated_at = now()
    where id = new.playlist_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.playlists set mix_count = greatest(mix_count - 1, 0), updated_at = now()
    where id = old.playlist_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger on_playlist_mix_change
  after insert or delete on public.playlist_mixes
  for each row
  execute function public.update_playlist_mix_count();

-- ===== HELPER RPC: ADD MIX TO PLAYLIST WITH AUTO-POSITION =====

create or replace function public.add_mix_to_playlist(
  p_playlist_id uuid,
  p_mix_id uuid
)
returns void
language plpgsql
security definer
as $$
declare
  next_pos int;
begin
  select coalesce(max(position), -1) + 1 into next_pos
  from public.playlist_mixes
  where playlist_id = p_playlist_id;

  insert into public.playlist_mixes (playlist_id, mix_id, position)
  values (p_playlist_id, p_mix_id, next_pos);
end;
$$;

-- ===== HELPER RPC: REORDER MIXES =====

create or replace function public.reorder_playlist_mixes(
  p_playlist_id uuid,
  p_mix_ids uuid[]
)
returns void
language plpgsql
security definer
as $$
begin
  delete from public.playlist_mixes
  where playlist_id = p_playlist_id
  and mix_id = any(p_mix_ids);

  for i in 0 .. array_length(p_mix_ids, 1) - 1 loop
    insert into public.playlist_mixes (playlist_id, mix_id, position)
    values (p_playlist_id, p_mix_ids[i + 1], i);
  end loop;
end;
$$;

-- ===== GET PLAYLIST WITH MIXES RPC =====

create or replace function public.get_playlist_with_mixes(
  p_playlist_id uuid
)
returns table (
  id uuid,
  owner_id uuid,
  title text,
  description text,
  artwork_url text,
  is_public boolean,
  mix_count int,
  created_at timestamptz,
  updated_at timestamptz,
  mix_id uuid,
  mix_title text,
  mix_artwork_url text,
  mix_audio_url text,
  mix_duration_seconds int,
  mix_play_count int,
  mix_like_count int,
  mix_genre_name text,
  mix_tags text[],
  mix_waveform_url text,
  mix_audio_quality text,
  mix_created_at timestamptz,
  mix_position int,
  dj_id uuid,
  dj_username text,
  dj_display_name text,
  dj_avatar_url text,
  owner_username text,
  owner_display_name text,
  owner_avatar_url text
)
language sql
stable
as $$
  select
    pl.id, pl.owner_id, pl.title, pl.description, pl.artwork_url,
    pl.is_public, pl.mix_count, pl.created_at, pl.updated_at,
    m.id as mix_id, m.title as mix_title, m.artwork_url as mix_artwork_url,
    m.audio_url as mix_audio_url, m.duration_seconds as mix_duration_seconds,
    m.play_count as mix_play_count, m.like_count as mix_like_count,
    g.name as mix_genre_name, m.tags as mix_tags,
    m.waveform_url as mix_waveform_url, m.audio_quality as mix_audio_quality,
    m.created_at as mix_created_at, pm.position as mix_position,
    p.id as dj_id, p.username as dj_username,
    p.display_name as dj_display_name, p.avatar_url as dj_avatar_url,
    po.username as owner_username, po.display_name as owner_display_name,
    po.avatar_url as owner_avatar_url
  from public.playlists pl
  join public.profiles po on po.id = pl.owner_id
  left join public.playlist_mixes pm on pm.playlist_id = pl.id
  left join public.mixes m on m.id = pm.mix_id
  left join public.profiles p on p.id = m.dj_id
  left join public.genres g on g.id = m.genre_id
  where pl.id = p_playlist_id
    and (pl.is_public = true or pl.owner_id = auth.uid())
  order by pm.position asc;
$$;

-- ===== GET PLAYLISTS BY USER =====

create or replace function public.get_playlists_by_user(
  p_user_id uuid,
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  id uuid,
  owner_id uuid,
  title text,
  description text,
  artwork_url text,
  is_public boolean,
  mix_count int,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
as $$
  select id, owner_id, title, description, artwork_url, is_public, mix_count, created_at, updated_at
  from public.playlists
  where owner_id = p_user_id
    and (is_public = true or owner_id = auth.uid())
  order by updated_at desc
  limit p_limit
  offset p_offset;
$$;
