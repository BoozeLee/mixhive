-- Migration 034: Audio intelligence MVP.
--
-- Stores low-cost DJ Set Analyzer outputs first: BPM, key/Camelot, mood,
-- energy, structure JSON, and optional timestamped track IDs. Expensive
-- recognition/stem work stays behind later Pro/vendor workflows.

begin;

create table if not exists public.audio_features (
  id uuid primary key default gen_random_uuid(),
  mix_id uuid not null unique references public.mixes(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'complete', 'failed')),
  bpm numeric(6,2),
  musical_key text,
  camelot text,
  mood text,
  energy numeric(4,3) check (energy is null or (energy >= 0 and energy <= 1)),
  danceability numeric(4,3) check (danceability is null or (danceability >= 0 and danceability <= 1)),
  structure_json jsonb not null default '{}',
  source text not null default 'mixhive-rule-v1',
  model text,
  confidence numeric(4,3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists audio_features_mix_status_idx
  on public.audio_features (mix_id, status);

alter table public.audio_features enable row level security;

drop policy if exists "audio_features_public_published_read" on public.audio_features;
create policy "audio_features_public_published_read"
  on public.audio_features for select
  using (
    exists (
      select 1 from public.mixes
      where mixes.id = audio_features.mix_id
        and mixes.published = true
    )
  );

drop policy if exists "audio_features_owner_write" on public.audio_features;
create policy "audio_features_owner_write"
  on public.audio_features for all
  using (
    exists (
      select 1 from public.mixes
      where mixes.id = audio_features.mix_id
        and mixes.dj_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.mixes
      where mixes.id = audio_features.mix_id
        and mixes.dj_id = auth.uid()
    )
  );

create table if not exists public.mix_tracks (
  id uuid primary key default gen_random_uuid(),
  mix_id uuid not null references public.mixes(id) on delete cascade,
  title text,
  artist text,
  label text,
  start_sec int not null default 0 check (start_sec >= 0),
  end_sec int check (end_sec is null or end_sec >= start_sec),
  confidence numeric(4,3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  source text not null default 'user',
  created_at timestamptz not null default now()
);

create index if not exists mix_tracks_mix_start_idx
  on public.mix_tracks (mix_id, start_sec);

alter table public.mix_tracks enable row level security;

drop policy if exists "mix_tracks_public_published_read" on public.mix_tracks;
create policy "mix_tracks_public_published_read"
  on public.mix_tracks for select
  using (
    exists (
      select 1 from public.mixes
      where mixes.id = mix_tracks.mix_id
        and mixes.published = true
    )
  );

drop policy if exists "mix_tracks_owner_write" on public.mix_tracks;
create policy "mix_tracks_owner_write"
  on public.mix_tracks for all
  using (
    exists (
      select 1 from public.mixes
      where mixes.id = mix_tracks.mix_id
        and mixes.dj_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.mixes
      where mixes.id = mix_tracks.mix_id
        and mixes.dj_id = auth.uid()
    )
  );

create or replace function public.update_audio_features_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists audio_features_updated_at on public.audio_features;
create trigger audio_features_updated_at
  before update on public.audio_features
  for each row execute function public.update_audio_features_updated_at();

commit;
