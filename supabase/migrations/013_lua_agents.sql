-- Migration 013: Lua agent layer
--
-- User-authored Lua scripts ("agents") that respond to MixHive events
-- — auto-welcome new followers, auto-respond to mentions, schedule
-- recurring posts, filter spam, customize feed recommendations, etc.
--
-- Architecture:
--   * lua_agents stores the script + metadata + per-trigger config
--   * lua_agent_runs is an append-only audit log of every execution
--   * pg_net (or Supabase Edge Function) dispatches matching events to
--     the Vercel Python function /api/lua-agent/run.py which executes
--     the script via Lupa with a CPU + memory + wall-clock sandbox
--
-- Resolves: Phase L (Lua) in the 5-star roadmap.

begin;

-- =====================================================================
-- TABLES
-- =====================================================================

create table if not exists public.lua_agents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  -- Which event fires this agent. NULL = manual / API-invoked only.
  trigger_type text check (
    trigger_type is null or trigger_type in (
      'on_follow',       -- someone follows the owner
      'on_unfollow',     -- someone unfollows the owner
      'on_mix_upload',   -- someone the owner follows publishes a mix
      'on_comment',      -- someone comments on the owner's mix
      'on_reply',        -- someone replies to the owner's comment
      'on_mention',      -- the owner is @mentioned anywhere
      'on_like',         -- someone likes the owner's mix
      'on_repost',       -- someone reposts the owner's mix
      'on_schedule',     -- fired on cron schedule (see cron_expr)
      'manual'           -- triggered explicitly via /api/lua-agent/run
    )
  ),
  -- For trigger_type = 'on_schedule', a 5-field cron expression.
  cron_expr text,
  -- The actual Lua source. Must compile against the sandbox stdlib in
  -- api/lua-agent/run.py. Capped at 64KB so we can't be DoS'd by a
  -- runaway script blob.
  lua_code text not null check (char_length(lua_code) between 1 and 65536),
  enabled boolean not null default true,
  -- Hard caps the Python runtime will enforce.
  timeout_ms int not null default 2000 check (timeout_ms between 100 and 30000),
  memory_kb int not null default 8192 check (memory_kb between 1024 and 65536),
  -- Counters maintained by the runtime.
  run_count int not null default 0,
  error_count int not null default 0,
  last_run_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (owner_id, name)
);

create index if not exists idx_lua_agents_owner on public.lua_agents(owner_id);
create index if not exists idx_lua_agents_trigger on public.lua_agents(trigger_type)
  where enabled = true;

-- Append-only execution log. Trimmed by the cron job below to keep
-- table size sane.
create table if not exists public.lua_agent_runs (
  id bigint generated always as identity primary key,
  agent_id uuid not null references public.lua_agents(id) on delete cascade,
  triggered_by text not null,   -- 'event:on_follow' | 'schedule' | 'manual' | etc.
  event_payload jsonb,
  status text not null check (status in ('ok', 'error', 'timeout', 'oom', 'denied')),
  duration_ms int,
  stdout text,                  -- captured Lua print()s
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_lua_agent_runs_agent
  on public.lua_agent_runs(agent_id, created_at desc);


-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================

alter table public.lua_agents enable row level security;
alter table public.lua_agent_runs enable row level security;

drop policy if exists "Users manage own agents" on public.lua_agents;
create policy "Users manage own agents"
  on public.lua_agents for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "Users read own agent runs" on public.lua_agent_runs;
create policy "Users read own agent runs"
  on public.lua_agent_runs for select
  using (
    exists (
      select 1 from public.lua_agents a
      where a.id = lua_agent_runs.agent_id
        and a.owner_id = auth.uid()
    )
  );

-- The Python runtime writes via the service-role key, which bypasses
-- RLS; we deliberately give the client no INSERT policy.


-- =====================================================================
-- HELPER RPC: maintain bookkeeping after a run
-- =====================================================================
-- Called by the Python runtime instead of issuing two separate writes.

create or replace function public.record_lua_agent_run(
  p_agent_id uuid,
  p_triggered_by text,
  p_event_payload jsonb,
  p_status text,
  p_duration_ms int,
  p_stdout text,
  p_error_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.lua_agent_runs(
    agent_id, triggered_by, event_payload, status,
    duration_ms, stdout, error_message
  ) values (
    p_agent_id, p_triggered_by, p_event_payload, p_status,
    p_duration_ms, p_stdout, p_error_message
  );

  update public.lua_agents
     set run_count   = run_count + 1,
         error_count = error_count + case when p_status <> 'ok' then 1 else 0 end,
         last_run_at = now(),
         last_error  = case when p_status <> 'ok' then p_error_message else null end,
         updated_at  = now()
   where id = p_agent_id;
end;
$$;

revoke all on function public.record_lua_agent_run from public;
-- The service-role grant is implicit; no client-facing role needs to call this.


-- =====================================================================
-- EVENT DISPATCH
-- =====================================================================
-- A single helper any future trigger can call to fan an event out to
-- matching agents. The Python runtime is invoked via pg_net (Supabase
-- ships pg_net pre-installed) so we don't block the originating
-- transaction waiting for Lua to run.

create or replace function public.dispatch_lua_event(
  p_owner_id uuid,
  p_trigger_type text,
  p_event_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent record;
  v_runtime_url text;
  v_service_key text;
begin
  -- Settings are written once via:
  --   alter database postgres set app.lua_runtime_url = 'https://...';
  --   alter database postgres set app.service_role_key = '...';
  -- We swallow the missing-setting error so this function stays
  -- non-blocking even before the operator wires it up.
  begin
    v_runtime_url := current_setting('app.lua_runtime_url');
    v_service_key := current_setting('app.service_role_key');
  exception when undefined_object then
    return;
  end;

  for v_agent in
    select id, timeout_ms
      from public.lua_agents
     where owner_id = p_owner_id
       and trigger_type = p_trigger_type
       and enabled = true
  loop
    -- pg_net is async; we don't await the response. The runtime calls
    -- record_lua_agent_run() to report status when it finishes.
    perform net.http_post(
      url     := v_runtime_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key
      ),
      body    := jsonb_build_object(
        'agent_id', v_agent.id,
        'triggered_by', 'event:' || p_trigger_type,
        'event', p_event_payload
      ),
      timeout_milliseconds := v_agent.timeout_ms + 1000
    );
  end loop;
end;
$$;

-- Wire up the most common triggers. Additional ones can be added as
-- separate small migrations.
create or replace function public.lua_on_follow()
returns trigger
language plpgsql
security definer
as $$
begin
  perform public.dispatch_lua_event(
    new.following_id,
    'on_follow',
    jsonb_build_object('actor_id', new.follower_id, 'created_at', new.created_at)
  );
  return new;
end;
$$;

drop trigger if exists on_follow_dispatch_lua on public.follows;
create trigger on_follow_dispatch_lua
  after insert on public.follows
  for each row execute function public.lua_on_follow();

create or replace function public.lua_on_comment()
returns trigger
language plpgsql
security definer
as $$
declare
  v_mix_owner uuid;
begin
  select dj_id into v_mix_owner from public.mixes where id = new.mix_id;
  if v_mix_owner is null or v_mix_owner = new.user_id then return new; end if;
  perform public.dispatch_lua_event(
    v_mix_owner,
    'on_comment',
    jsonb_build_object(
      'actor_id',  new.user_id,
      'mix_id',    new.mix_id,
      'comment_id', new.id,
      'body',      new.body,
      'created_at', new.created_at
    )
  );
  return new;
end;
$$;

drop trigger if exists on_comment_dispatch_lua on public.comments;
create trigger on_comment_dispatch_lua
  after insert on public.comments
  for each row execute function public.lua_on_comment();


commit;
