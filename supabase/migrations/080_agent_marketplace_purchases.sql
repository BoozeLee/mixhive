-- Migration 080: Agent marketplace purchase records
--
-- Adds lua_agent_package_purchases to track paid agent installs.
-- The 70/30 revenue split (creator / platform) is stored as platform_fee_pct.
-- Purchase state transitions: pending_payment → completed (webhook) or failed.
-- After payment completes, the webhook calls install_agent_package and sets
-- agent_id so the row links back to the installed lua_agent record.
--
-- Resolves: Phase 16 — agent marketplace paid tiers

begin;

create table if not exists lua_agent_package_purchases (
  id                  uuid         primary key default gen_random_uuid(),
  package_id          uuid         not null references lua_agent_packages(id) on delete cascade,
  buyer_profile_id    uuid         not null references profiles(id) on delete cascade,
  creator_profile_id  uuid         references profiles(id) on delete set null,
  amount_paid         numeric(8,2) not null,
  currency            text         not null default 'EUR',
  platform_fee_pct    numeric(5,2) not null default 30.00,
  payment_provider    text         not null default 'stripe',
  payment_reference   text,
  purchase_state      text         not null default 'pending_payment',
  agent_id            uuid         references lua_agents(id) on delete set null,
  created_at          timestamptz  not null default now(),
  resolved_at         timestamptz,
  constraint purchase_state_check
    check (purchase_state in ('pending_payment', 'completed', 'refunded', 'failed'))
);

create index if not exists lua_agent_purchases_buyer_idx
  on lua_agent_package_purchases (buyer_profile_id, purchase_state);

create index if not exists lua_agent_purchases_package_idx
  on lua_agent_package_purchases (package_id);

alter table lua_agent_package_purchases enable row level security;

-- Buyers can see their own purchases
drop policy if exists "agent_purchases_buyer_select" on lua_agent_package_purchases;
create policy "agent_purchases_buyer_select"
  on lua_agent_package_purchases for select
  using (buyer_profile_id = auth.uid());

-- Creators can see sales of their packages
drop policy if exists "agent_purchases_creator_select" on lua_agent_package_purchases;
create policy "agent_purchases_creator_select"
  on lua_agent_package_purchases for select
  using (creator_profile_id = auth.uid());

commit;

-- Resolves: Phase 16 — agent marketplace paid tiers
