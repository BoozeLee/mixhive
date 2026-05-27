-- Migration 035: wasmoon strategic agent registry
--
-- This is the DB-backed registry for the higher-level AI agent system
-- described in the MIXHIVE research plan. It intentionally coexists with
-- lua_agents / lua_agent_runs from migrations 013-016/033, which remain the
-- user-authored automation product.

begin;

create table if not exists public.agent_registry (
  id text primary key,
  display_name text not null,
  description text,
  tier text not null default 'free' check (tier in ('free', 'pro', 'partner')),
  lua_script text not null,
  lua_script_version integer not null default 1,
  tools_whitelist text[] not null default '{}',
  approval_policy text not null default 'on_action' check (approval_policy in ('auto', 'always', 'on_action')),
  timeout_ms integer not null default 30000 check (timeout_ms between 100 and 120000),
  max_tokens_per_run integer not null default 4096,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null references public.agent_registry(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  trigger text,
  status text not null check (status in ('ok', 'needs_approval', 'error', 'skipped')),
  duration_ms integer,
  tokens_used integer not null default 0,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_runs_profile_created
  on public.agent_runs(profile_id, created_at desc);

create index if not exists idx_agent_runs_agent_created
  on public.agent_runs(agent_id, created_at desc);

alter table public.agent_registry enable row level security;
alter table public.agent_runs enable row level security;

drop policy if exists "Agent registry readable" on public.agent_registry;
create policy "Agent registry readable"
  on public.agent_registry for select
  using (enabled = true);

drop policy if exists "Users read own strategic agent runs" on public.agent_runs;
create policy "Users read own strategic agent runs"
  on public.agent_runs for select
  using (profile_id = auth.uid());

insert into public.agent_registry (
  id,
  display_name,
  description,
  tier,
  tools_whitelist,
  approval_policy,
  timeout_ms,
  lua_script
) values
  ('profile_coach', 'Profile Coach', 'Scores and improves creator profile readiness.', 'free', array['db.read_one','db.read','db.upsert','audio.features','llm.call','llm.json'], 'on_action', 25000, '-- loaded from version-controlled agent source'),
  ('release_strategy', 'Release Strategy', 'Plans release timing and campaign next steps.', 'pro', array['db.read_one','db.read','llm.call','llm.json','vector.embed','vector.search'], 'always', 30000, '-- loaded from version-controlled agent source'),
  ('booking_scout', 'Booking Scout', 'Finds venue and gig fits with reviewed outreach drafts.', 'free', array['db.read_one','db.read','vector.embed','vector.search','llm.call','llm.json'], 'on_action', 30000, '-- loaded from version-controlled agent source'),
  ('opportunity_match', 'Opportunity Match', 'Ranks grants, gigs, calls, residencies, and festivals.', 'free', array['db.read_one','db.read','vector.embed','vector.search','llm.call','llm.json'], 'auto', 30000, '-- loaded from version-controlled agent source'),
  ('collaboration_match', 'Collaboration Match', 'Finds complementary collaborators and intro drafts.', 'free', array['db.read_one','db.read','vector.embed','vector.search','llm.call','llm.json'], 'on_action', 30000, '-- loaded from version-controlled agent source'),
  ('scene_radar', 'Scene Radar', 'Summarizes aggregate movement in local underground scenes.', 'free', array['db.read_one','db.read','llm.call'], 'auto', 20000, '-- loaded from version-controlled agent source'),
  ('fan_insights', 'Fan Insights', 'Clusters audience and engagement signals.', 'pro', array['db.read_one','db.read','llm.call','llm.json','vector.embed'], 'auto', 30000, '-- loaded from version-controlled agent source'),
  ('event_organizer', 'Event Organizer', 'Helps partners assemble lineups and event plans.', 'partner', array['db.read','db.insert','vector.embed','vector.search','llm.call','llm.json'], 'always', 30000, '-- loaded from version-controlled agent source'),
  ('venue_fit', 'Venue Fit', 'Scores artist-to-venue compatibility.', 'pro', array['db.read_one','db.read','vector.embed','vector.search','llm.call'], 'auto', 20000, '-- loaded from version-controlled agent source'),
  ('press_kit', 'Press Kit', 'Generates a reviewable one-page EPK draft.', 'free', array['db.read_one','db.read','db.upsert','llm.call','llm.json'], 'always', 30000, '-- loaded from version-controlled agent source'),
  ('grant_assistant', 'Grant Assistant', 'Scores funding fit and drafts applications.', 'free', array['db.read_one','db.read','llm.call','llm.json'], 'always', 30000, '-- loaded from version-controlled agent source'),
  ('moderation', 'Moderation', 'Flags spam, abuse, fraud, and severe harm.', 'free', array['db.read_one','db.update','db.insert','llm.call','llm.json'], 'on_action', 15000, '-- loaded from version-controlled agent source'),
  ('trend_intelligence', 'Trend Intelligence', 'Builds aggregate trend reports.', 'free', array['db.read','db.upsert','llm.call','llm.json'], 'auto', 45000, '-- loaded from version-controlled agent source'),
  ('label_scout', 'Label Scout', 'Finds labels and collectives that fit an artist.', 'pro', array['db.read_one','db.read','vector.embed','vector.search','llm.call','llm.json'], 'on_action', 30000, '-- loaded from version-controlled agent source'),
  ('visual_identity', 'Visual Identity', 'Creates coherent visual identity briefs.', 'pro', array['db.read_one','db.read','llm.call','llm.json'], 'always', 20000, '-- loaded from version-controlled agent source'),
  ('dj_set_analyzer', 'DJ Set Analyzer', 'Turns audio features and tracklists into set intelligence.', 'pro', array['db.read_one','db.read','db.update','audio.features','audio.tracklist','audio.trigger_analysis','llm.call','llm.json'], 'auto', 45000, '-- loaded from version-controlled agent source'),
  ('community_manager', 'Community Manager', 'Drafts reviewed replies and community prompts.', 'free', array['db.read','llm.call'], 'on_action', 20000, '-- loaded from version-controlled agent source'),
  ('notification_prioritizer', 'Notification Prioritizer', 'Ranks notifications into daily focus.', 'free', array['db.read','llm.call','llm.json'], 'auto', 15000, '-- loaded from version-controlled agent source')
on conflict (id) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  tier = excluded.tier,
  tools_whitelist = excluded.tools_whitelist,
  approval_policy = excluded.approval_policy,
  timeout_ms = excluded.timeout_ms,
  updated_at = now();

commit;
