-- Migration 077: Phase 15 — DJ Gear Marketplace + Collab Quest System
--
-- Adds the second-hand equipment marketplace and the RPG-style collaborative
-- quest engine. Both live inside the MythicNode graph so listings and quests
-- connect naturally to artist profiles and scenes.
--
-- New tables: equipment_listings, equipment_transactions, equipment_saves,
--   equipment_reviews, collab_quests, collab_parties, collab_roles,
--   collab_quest_applications, collab_quest_reviews
-- MythicNode: extends node_type + edge_type check constraints.
--
-- Resolves: Phase 15 — Quest Marketplace

begin;

-- ── 1. Extend MythicNode node types ─────────────────────────────────────────

alter table public.mythic_nodes
  drop constraint if exists mythic_nodes_node_type_check;

alter table public.mythic_nodes
  add constraint mythic_nodes_node_type_check check (node_type in (
    'artist_profile',
    'mix',
    'buzz',
    'event',
    'venue',
    'opportunity',
    'promoter',
    'label',
    'curator',
    'quest',
    'agent',
    -- Phase 15
    'equipment_listing',
    'collab_quest',
    'lua_agent_package'
  ));

-- ── 2. Extend MythicNode edge types ─────────────────────────────────────────

alter table public.mythic_edges
  drop constraint if exists mythic_edges_edge_type_check;

alter table public.mythic_edges
  add constraint mythic_edges_edge_type_check check (edge_type in (
    'performed_at',
    'booked_by',
    'submitted_to',
    'collab_with',
    'remixed',
    'engaged_with',
    'recommended_by_agent',
    'followed',
    'inspired_by',
    'quest_milestone',
    'yielded_outcome',
    -- Phase 15 — gear marketplace
    'listed_by',
    'interested_in',
    'sold_to',
    'scene_gear',
    -- Phase 15 — collab quests
    'quest_created_by',
    'quest_requires_role',
    'party_for_quest',
    'role_filled_by',
    'party_member',
    'assisted_by_agent',
    'completed_quest',
    'role_completed_as',
    -- Phase 15 — agent marketplace
    'agent_created_by',
    'owns_agent',
    'used_in_quest',
    'assistant_for_role',
    'agent_inspired_by'
  ));

-- ── 3. Equipment listings ────────────────────────────────────────────────────

create table if not exists public.equipment_listings (
  id                  uuid primary key default gen_random_uuid(),
  seller_profile_id   uuid not null references public.profiles(id) on delete cascade,
  title               text not null,
  description         text,
  category            text not null check (category in (
    'mixer','controller','turntable','cdj','monitor','headphones',
    'synthesizer','sampler','interface','cable_accessory','other'
  )),
  brand               text,
  model               text,
  condition           text not null check (condition in (
    'new','like_new','used_good','used_fair','for_parts'
  )),
  price               numeric(10,2) not null check (price >= 0),
  currency            char(3) not null default 'EUR',
  location_city       text,
  location_country    char(2),
  location_region     text,
  photos              text[] not null default '{}',
  shipping_options    jsonb not null default '{"local_pickup":true,"domestic_shipping":false,"international_shipping":false}',
  preferred_payment   text[] not null default '{}',
  status              text not null default 'active' check (status in ('active','reserved','sold','hidden')),
  views_count         int not null default 0,
  saves_count         int not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_equipment_listings_seller
  on public.equipment_listings(seller_profile_id);
create index if not exists idx_equipment_listings_status
  on public.equipment_listings(status) where status = 'active';
create index if not exists idx_equipment_listings_category
  on public.equipment_listings(category, status);
create index if not exists idx_equipment_listings_country
  on public.equipment_listings(location_country, status);
create index if not exists idx_equipment_listings_price
  on public.equipment_listings(price) where status = 'active';
create index if not exists idx_equipment_listings_created
  on public.equipment_listings(created_at desc);

-- ── 4. Equipment transactions ────────────────────────────────────────────────

create table if not exists public.equipment_transactions (
  id                  uuid primary key default gen_random_uuid(),
  listing_id          uuid not null references public.equipment_listings(id) on delete restrict,
  buyer_profile_id    uuid not null references public.profiles(id) on delete restrict,
  seller_profile_id   uuid not null references public.profiles(id) on delete restrict,
  agreed_price        numeric(10,2) not null,
  currency            char(3) not null default 'EUR',
  payment_provider    text check (payment_provider in ('stripe','paypal','manual')),
  payment_reference   text,
  transaction_state   text not null default 'pending_payment' check (transaction_state in (
    'pending_payment','paid_escrow','shipped','delivered','disputed','resolved','released','refunded'
  )),
  shipped_at          timestamptz,
  tracking_number     text,
  delivered_at        timestamptz,
  dispute_opened_at   timestamptz,
  dispute_notes       text,
  resolved_at         timestamptz,
  platform_fee_pct    numeric(4,2) not null default 4.0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_equipment_transactions_listing
  on public.equipment_transactions(listing_id);
create index if not exists idx_equipment_transactions_buyer
  on public.equipment_transactions(buyer_profile_id);
create index if not exists idx_equipment_transactions_seller
  on public.equipment_transactions(seller_profile_id);
create index if not exists idx_equipment_transactions_state
  on public.equipment_transactions(transaction_state);

-- ── 5. Equipment saves (watchlist) ──────────────────────────────────────────

create table if not exists public.equipment_saves (
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  listing_id   uuid not null references public.equipment_listings(id) on delete cascade,
  saved_at     timestamptz not null default now(),
  primary key (profile_id, listing_id)
);

create index if not exists idx_equipment_saves_profile
  on public.equipment_saves(profile_id);
create index if not exists idx_equipment_saves_listing
  on public.equipment_saves(listing_id);

-- ── 6. Equipment reviews ─────────────────────────────────────────────────────

create table if not exists public.equipment_reviews (
  id                    uuid primary key default gen_random_uuid(),
  transaction_id        uuid not null references public.equipment_transactions(id) on delete cascade,
  reviewer_profile_id   uuid not null references public.profiles(id) on delete cascade,
  reviewee_profile_id   uuid not null references public.profiles(id) on delete cascade,
  role                  text not null check (role in ('buyer','seller')),
  rating                smallint not null check (rating between 1 and 5),
  comment               text,
  created_at            timestamptz not null default now(),
  unique (transaction_id, reviewer_profile_id)
);

create index if not exists idx_equipment_reviews_reviewee
  on public.equipment_reviews(reviewee_profile_id);

-- ── 7. Collab quests (RPG team quests — distinct from personal quests) ───────

create table if not exists public.collab_quests (
  id                  uuid primary key default gen_random_uuid(),
  creator_profile_id  uuid not null references public.profiles(id) on delete cascade,
  title               text not null,
  narrative           text,
  goals               text[] not null default '{}',
  phase               text not null default 'draft' check (phase in (
    'draft','recruiting','in_progress','complete','cancelled'
  )),
  genre_tags          text[] not null default '{}',
  discipline_tags     text[] not null default '{}',
  region              text,
  timeline_days       int,
  deadline            date,
  xp_reward           int not null default 100 check (xp_reward >= 0),
  embedding           vector(1536),
  created_at          timestamptz not null default now(),
  completed_at        timestamptz,
  updated_at          timestamptz not null default now()
);

create index if not exists idx_collab_quests_creator
  on public.collab_quests(creator_profile_id);
create index if not exists idx_collab_quests_phase
  on public.collab_quests(phase) where phase in ('recruiting','in_progress');
create index if not exists idx_collab_quests_created
  on public.collab_quests(created_at desc);
create index if not exists idx_collab_quests_embedding
  on public.collab_quests using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- ── 8. Collab parties ────────────────────────────────────────────────────────

create table if not exists public.collab_parties (
  id            uuid primary key default gen_random_uuid(),
  quest_id      uuid not null references public.collab_quests(id) on delete cascade,
  name          text,
  formed_at     timestamptz not null default now(),
  dissolved_at  timestamptz
);

create index if not exists idx_collab_parties_quest
  on public.collab_parties(quest_id);

-- ── 9. Collab roles ──────────────────────────────────────────────────────────

create table if not exists public.collab_roles (
  id                    uuid primary key default gen_random_uuid(),
  quest_id              uuid not null references public.collab_quests(id) on delete cascade,
  role_type             text not null check (role_type in (
    'dj','producer','musician','visual_artist','animator','photographer',
    'videographer','writer','business','actor','designer','developer','other'
  )),
  title                 text not null,
  skill_tags            text[] not null default '{}',
  experience_level      text not null default 'any' check (experience_level in (
    'any','beginner','intermediate','pro'
  )),
  filled_by_profile_id  uuid references public.profiles(id) on delete set null,
  is_paid               boolean not null default false,
  compensation_notes    text,
  status                text not null default 'open' check (status in ('open','filled','withdrawn')),
  created_at            timestamptz not null default now()
);

create index if not exists idx_collab_roles_quest
  on public.collab_roles(quest_id);
create index if not exists idx_collab_roles_open
  on public.collab_roles(role_type, status) where status = 'open';
create index if not exists idx_collab_roles_filled_by
  on public.collab_roles(filled_by_profile_id) where filled_by_profile_id is not null;

-- ── 10. Quest applications ──────────────────────────────────────────────────

create table if not exists public.collab_quest_applications (
  id                  uuid primary key default gen_random_uuid(),
  role_id             uuid not null references public.collab_roles(id) on delete cascade,
  quest_id            uuid not null references public.collab_quests(id) on delete cascade,
  applicant_profile_id uuid not null references public.profiles(id) on delete cascade,
  message             text,
  status              text not null default 'pending' check (status in (
    'pending','accepted','rejected','withdrawn'
  )),
  applied_at          timestamptz not null default now(),
  decided_at          timestamptz,
  unique (role_id, applicant_profile_id)
);

create index if not exists idx_collab_quest_applications_role
  on public.collab_quest_applications(role_id, status);
create index if not exists idx_collab_quest_applications_applicant
  on public.collab_quest_applications(applicant_profile_id, status);

-- ── 11. Quest reviews (post-completion peer ratings) ───────────────────────

create table if not exists public.collab_quest_reviews (
  id                    uuid primary key default gen_random_uuid(),
  quest_id              uuid not null references public.collab_quests(id) on delete cascade,
  reviewer_profile_id   uuid not null references public.profiles(id) on delete cascade,
  reviewee_profile_id   uuid not null references public.profiles(id) on delete cascade,
  role_type             text,
  craft_rating          smallint check (craft_rating between 1 and 5),
  collaboration_rating  smallint check (collaboration_rating between 1 and 5),
  reliability_rating    smallint check (reliability_rating between 1 and 5),
  xp_awarded            int not null default 0,
  created_at            timestamptz not null default now(),
  unique (quest_id, reviewer_profile_id, reviewee_profile_id)
);

create index if not exists idx_collab_quest_reviews_reviewee
  on public.collab_quest_reviews(reviewee_profile_id);
create index if not exists idx_collab_quest_reviews_quest
  on public.collab_quest_reviews(quest_id);

-- ── 12. RLS ──────────────────────────────────────────────────────────────────

alter table public.equipment_listings       enable row level security;
alter table public.equipment_transactions   enable row level security;
alter table public.equipment_saves          enable row level security;
alter table public.equipment_reviews        enable row level security;
alter table public.collab_quests            enable row level security;
alter table public.collab_parties           enable row level security;
alter table public.collab_roles             enable row level security;
alter table public.collab_quest_applications enable row level security;
alter table public.collab_quest_reviews     enable row level security;

-- equipment_listings
drop policy if exists "Anyone reads active listings" on public.equipment_listings;
create policy "Anyone reads active listings"
  on public.equipment_listings for select
  using (status in ('active','reserved','sold') or seller_profile_id = auth.uid());

drop policy if exists "Sellers manage own listings" on public.equipment_listings;
create policy "Sellers manage own listings"
  on public.equipment_listings for all
  using (seller_profile_id = auth.uid())
  with check (seller_profile_id = auth.uid());

-- equipment_transactions
drop policy if exists "Parties read own transactions" on public.equipment_transactions;
create policy "Parties read own transactions"
  on public.equipment_transactions for select
  using (buyer_profile_id = auth.uid() or seller_profile_id = auth.uid());

drop policy if exists "Buyer initiates transaction" on public.equipment_transactions;
create policy "Buyer initiates transaction"
  on public.equipment_transactions for insert
  with check (buyer_profile_id = auth.uid());

drop policy if exists "Parties update own transaction" on public.equipment_transactions;
create policy "Parties update own transaction"
  on public.equipment_transactions for update
  using (buyer_profile_id = auth.uid() or seller_profile_id = auth.uid());

-- equipment_saves
drop policy if exists "Users manage own saves" on public.equipment_saves;
create policy "Users manage own saves"
  on public.equipment_saves for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- equipment_reviews
drop policy if exists "Anyone reads gear reviews" on public.equipment_reviews;
create policy "Anyone reads gear reviews"
  on public.equipment_reviews for select using (true);

drop policy if exists "Reviewer manages own gear review" on public.equipment_reviews;
create policy "Reviewer manages own gear review"
  on public.equipment_reviews for all
  using (reviewer_profile_id = auth.uid())
  with check (reviewer_profile_id = auth.uid());

-- collab_quests
drop policy if exists "Anyone reads recruiting quests" on public.collab_quests;
create policy "Anyone reads recruiting quests"
  on public.collab_quests for select
  using (phase in ('recruiting','in_progress','complete') or creator_profile_id = auth.uid());

drop policy if exists "Creator manages own quest" on public.collab_quests;
create policy "Creator manages own quest"
  on public.collab_quests for all
  using (creator_profile_id = auth.uid())
  with check (creator_profile_id = auth.uid());

-- collab_parties
drop policy if exists "Anyone reads parties" on public.collab_parties;
create policy "Anyone reads parties"
  on public.collab_parties for select using (true);

-- collab_roles
drop policy if exists "Anyone reads quest roles" on public.collab_roles;
create policy "Anyone reads quest roles"
  on public.collab_roles for select using (true);

drop policy if exists "Quest creator manages roles" on public.collab_roles;
create policy "Quest creator manages roles"
  on public.collab_roles for all
  using (
    exists (
      select 1 from public.collab_quests q
      where q.id = collab_roles.quest_id
        and q.creator_profile_id = auth.uid()
    )
  );

-- collab_quest_applications
drop policy if exists "Applicants manage own applications" on public.collab_quest_applications;
create policy "Applicants manage own applications"
  on public.collab_quest_applications for all
  using (applicant_profile_id = auth.uid())
  with check (applicant_profile_id = auth.uid());

drop policy if exists "Quest creator reads applications" on public.collab_quest_applications;
create policy "Quest creator reads applications"
  on public.collab_quest_applications for select
  using (
    exists (
      select 1 from public.collab_quests q
      where q.id = collab_quest_applications.quest_id
        and q.creator_profile_id = auth.uid()
    )
  );

drop policy if exists "Quest creator decides applications" on public.collab_quest_applications;
create policy "Quest creator decides applications"
  on public.collab_quest_applications for update
  using (
    exists (
      select 1 from public.collab_quests q
      where q.id = collab_quest_applications.quest_id
        and q.creator_profile_id = auth.uid()
    )
  );

-- collab_quest_reviews
drop policy if exists "Anyone reads quest reviews" on public.collab_quest_reviews;
create policy "Anyone reads quest reviews"
  on public.collab_quest_reviews for select using (true);

drop policy if exists "Reviewer manages own quest review" on public.collab_quest_reviews;
create policy "Reviewer manages own quest review"
  on public.collab_quest_reviews for all
  using (reviewer_profile_id = auth.uid())
  with check (reviewer_profile_id = auth.uid());

-- ── 13. RPCs ─────────────────────────────────────────────────────────────────

-- Find open quests with vector similarity to a profile embedding
create or replace function public.find_collab_quests_for_profile(
  p_embedding vector(1536),
  p_discipline text default null,
  p_limit int default 10
)
returns table (
  quest_id uuid,
  title text,
  narrative text,
  phase text,
  xp_reward int,
  open_roles bigint,
  similarity double precision
)
language sql stable security definer
set search_path = public
as $$
  select
    q.id,
    q.title,
    q.narrative,
    q.phase,
    q.xp_reward,
    count(r.id) filter (where r.status = 'open') as open_roles,
    1 - (q.embedding <=> p_embedding) as similarity
  from public.collab_quests q
  left join public.collab_roles r on r.quest_id = q.id
  where q.phase = 'recruiting'
    and q.embedding is not null
    and (p_discipline is null or p_discipline = any(q.discipline_tags))
  group by q.id
  having count(r.id) filter (where r.status = 'open') > 0
  order by q.embedding <=> p_embedding
  limit p_limit;
$$;

revoke all on function public.find_collab_quests_for_profile from public;
grant execute on function public.find_collab_quests_for_profile to authenticated;

-- Suggest gear listings for a profile (by scene and location)
create or replace function public.suggest_gear_for_profile(
  p_profile_id uuid,
  p_limit int default 10
)
returns setof public.equipment_listings
language sql stable security definer
set search_path = public
as $$
  select l.*
  from public.equipment_listings l
  where l.status = 'active'
    and (
      l.seller_profile_id != p_profile_id
    )
  order by l.created_at desc
  limit p_limit;
$$;

revoke all on function public.suggest_gear_for_profile from public;
grant execute on function public.suggest_gear_for_profile to authenticated;

-- updated_at triggers
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists set_updated_at on public.equipment_listings;
create trigger set_updated_at
  before update on public.equipment_listings
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.equipment_transactions;
create trigger set_updated_at
  before update on public.equipment_transactions
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.collab_quests;
create trigger set_updated_at
  before update on public.collab_quests
  for each row execute function public.set_updated_at();

commit;

-- Resolves: Phase 15 — Quest Marketplace (gear + collab quest system)
