-- Premium Mix Gating: required subscription tier for mix access
alter table public.mixes add column if not exists required_tier text not null default 'free'
  check (required_tier in ('free', 'supporter', 'insider', 'patron'));
