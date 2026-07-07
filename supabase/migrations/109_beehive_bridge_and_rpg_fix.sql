-- Migration 109: Beehive Studio provenance and RPG notification types
begin;

-- 1. Add Beehive provenance to mixes
alter table public.mixes
  add column if not exists published_from text,
  add column if not exists beehive_metadata jsonb default '{}'::jsonb;

create index if not exists idx_mixes_published_from on public.mixes(published_from);

-- 2. Expand notification types
alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type = any (array[
    'like', 'follow', 'comment', 'reply', 'mix_upload', 'mention',
    'buzz_like', 'repost', 'verification', 'message',
    'agent_notification', 'agent_purchased', 'agent_sale',
    'gear_sale', 'gear_shipped', 'gear_delivered', 'gear_confirmed',
    'gear_payout', 'gear_refunded', 'gear_disputed', 'earnings_paid',
    'quest_complete', 'beehive_publish'
  ]));

commit;
