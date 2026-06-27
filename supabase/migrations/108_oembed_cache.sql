-- Migration 108: cache oEmbed metadata so we don't hammer providers.

begin;

create table if not exists public.oembed_cache (
  url         text primary key,
  provider    text not null,
  title       text,
  description text,
  thumbnail_url text,
  html        text,
  author_name text,
  cached_at   timestamptz not null default now()
);

alter table public.oembed_cache enable row level security;

drop policy if exists "oEmbed cache is publicly readable" on public.oembed_cache;
create policy "oEmbed cache is publicly readable"
  on public.oembed_cache for select using (true);

-- Only service role / cron writes; no public insert/update policy needed.

commit;
