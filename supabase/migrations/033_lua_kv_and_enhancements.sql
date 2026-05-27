-- Migration 033: Lua agent infrastructure enhancements
--
-- 1. agent_kv    — per-agent persistent key-value store with optional TTL.
--                  Enables deduplication, rate-tracking, and stateful logic.
-- 2. on_reply    — dispatch trigger for comment replies (the trigger_type
--                  existed in the check constraint since 013 but had no
--                  Postgres trigger firing it).
-- 3. auto-disable — add consecutive_error_count to lua_agents; update
--                   record_lua_agent_run() to auto-disable after 10
--                   consecutive failures so runaway broken agents don't
--                   burn pg_net quota or confuse users.
-- 4. KV RPCs     — agent_kv_get / agent_kv_set / agent_kv_del / agent_kv_list
--                  called by the Python runtime via service role.
-- 5. pg_cron job — hourly sweep of expired KV entries.
--
-- Resolves: Phase L+ agent infrastructure.

begin;


-- =====================================================================
-- 0. Base Lua agent tables and fork RPC
-- =====================================================================

create table if not exists public.lua_agents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  trigger_type text check (
    trigger_type is null or trigger_type in (
      'on_follow',
      'on_unfollow',
      'on_mix_upload',
      'on_comment',
      'on_reply',
      'on_mention',
      'on_like',
      'on_repost',
      'on_schedule',
      'manual'
    )
  ),
  cron_expr text,
  lua_code text not null check (char_length(lua_code) between 1 and 65536),
  enabled boolean not null default true,
  timeout_ms int not null default 2000 check (timeout_ms between 100 and 30000),
  memory_kb int not null default 8192 check (memory_kb between 1024 and 65536),
  run_count int not null default 0,
  error_count int not null default 0,
  consecutive_error_count int not null default 0,
  last_run_at timestamptz,
  last_error text,
  is_public boolean not null default false,
  fork_of uuid references public.lua_agents(id) on delete set null,
  fork_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, name)
);

create index if not exists idx_lua_agents_owner on public.lua_agents(owner_id);
create index if not exists idx_lua_agents_trigger on public.lua_agents(trigger_type)
  where enabled = true;
create index if not exists idx_lua_agents_public on public.lua_agents(is_public, updated_at desc)
  where is_public = true;

create table if not exists public.lua_agent_runs (
  id bigint generated always as identity primary key,
  agent_id uuid not null references public.lua_agents(id) on delete cascade,
  triggered_by text not null,
  event_payload jsonb,
  status text not null check (status in ('ok', 'error', 'timeout', 'oom', 'denied')),
  duration_ms int,
  stdout text,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_lua_agent_runs_agent
  on public.lua_agent_runs(agent_id, created_at desc);

alter table public.lua_agents enable row level security;
alter table public.lua_agent_runs enable row level security;

drop policy if exists "Users manage own agents" on public.lua_agents;
create policy "Users manage own agents"
  on public.lua_agents for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "Public agents are readable" on public.lua_agents;
create policy "Public agents are readable"
  on public.lua_agents for select
  using (is_public = true);

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

create or replace function public.fork_lua_agent(p_source_id uuid, p_new_name text default null)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_source public.lua_agents%rowtype;
  v_new_id uuid;
  v_name   text;
begin
  if auth.uid() is null then
    raise exception 'must be signed in to fork an agent';
  end if;

  select * into v_source
    from public.lua_agents
   where id = p_source_id
     and (is_public = true or owner_id = auth.uid());

  if v_source.id is null then
    raise exception 'agent % not found or not public', p_source_id;
  end if;

  v_name := coalesce(p_new_name, v_source.name || ' (fork)');

  insert into public.lua_agents(
    owner_id, name, description, trigger_type, cron_expr, lua_code,
    enabled, timeout_ms, memory_kb, fork_of, is_public
  )
  values (
    auth.uid(),
    v_name,
    v_source.description,
    v_source.trigger_type,
    v_source.cron_expr,
    v_source.lua_code,
    false,
    v_source.timeout_ms,
    v_source.memory_kb,
    v_source.id,
    false
  )
  returning id into v_new_id;

  update public.lua_agents
     set fork_count = fork_count + 1
   where id = v_source.id;

  return v_new_id;
end;
$$;


-- =====================================================================
-- 1. agent_kv  — persistent per-agent key-value store
-- =====================================================================

create table if not exists public.agent_kv (
  agent_id   uuid  not null references public.lua_agents(id) on delete cascade,
  key        text  not null check (char_length(key) between 1 and 128),
  value      text           check (char_length(value) <= 4096),
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (agent_id, key)
);

create index if not exists idx_agent_kv_expires
  on public.agent_kv(expires_at)
  where expires_at is not null;

alter table public.agent_kv enable row level security;

-- Owners can read their agent's KV pairs (inspect in the UI).
-- Writes come exclusively from the service-role runtime.
drop policy if exists "Agent owner reads kv" on public.agent_kv;
create policy "Agent owner reads kv"
  on public.agent_kv for select
  using (
    exists (
      select 1 from public.lua_agents a
      where a.id = agent_kv.agent_id
        and a.owner_id = auth.uid()
    )
  );


-- =====================================================================
-- 2. consecutive_error_count column
-- =====================================================================

alter table public.lua_agents
  add column if not exists consecutive_error_count int not null default 0;


-- =====================================================================
-- 3. record_lua_agent_run — updated with auto-disable logic
-- =====================================================================

create or replace function public.record_lua_agent_run(
  p_agent_id      uuid,
  p_triggered_by  text,
  p_event_payload jsonb,
  p_status        text,
  p_duration_ms   int,
  p_stdout        text,
  p_error_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_consec int;
begin
  insert into public.lua_agent_runs(
    agent_id, triggered_by, event_payload, status,
    duration_ms, stdout, error_message
  ) values (
    p_agent_id, p_triggered_by, p_event_payload, p_status,
    p_duration_ms, p_stdout, p_error_message
  );

  if p_status = 'ok' then
    update public.lua_agents
       set run_count              = run_count + 1,
           consecutive_error_count = 0,
           last_run_at            = now(),
           last_error             = null,
           updated_at             = now()
     where id = p_agent_id;
  else
    update public.lua_agents
       set run_count              = run_count + 1,
           error_count            = error_count + 1,
           consecutive_error_count = consecutive_error_count + 1,
           last_run_at            = now(),
           last_error             = p_error_message,
           updated_at             = now()
     where id = p_agent_id
     returning consecutive_error_count into v_new_consec;

    -- Auto-disable after 10 consecutive failures.
    if v_new_consec >= 10 then
      update public.lua_agents
         set enabled = false,
             last_error = coalesce(p_error_message, last_error) || ' [auto-disabled after 10 consecutive errors]'
       where id = p_agent_id;
    end if;
  end if;
end;
$$;

revoke all on function public.record_lua_agent_run from public;


-- =====================================================================
-- 4. KV helper RPCs — security definer, callable by service-role only
-- =====================================================================

create or replace function public.agent_kv_get(
  p_agent_id uuid,
  p_key      text
)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select value
    from public.agent_kv
   where agent_id = p_agent_id
     and key      = p_key
     and (expires_at is null or expires_at > now());
$$;

revoke all on function public.agent_kv_get from public;


create or replace function public.agent_kv_set(
  p_agent_id       uuid,
  p_key            text,
  p_value          text,
  p_ttl_seconds    int default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count bigint;
  v_limit constant int := 256;
begin
  -- Hard cap: max 256 keys per agent to prevent abuse.
  select count(*) into v_count
    from public.agent_kv
   where agent_id = p_agent_id;

  if v_count >= v_limit and not exists (
    select 1 from public.agent_kv
     where agent_id = p_agent_id and key = p_key
  ) then
    raise exception 'agent_kv cap reached (max % keys per agent)', v_limit;
  end if;

  insert into public.agent_kv(agent_id, key, value, expires_at, updated_at)
  values (
    p_agent_id,
    p_key,
    p_value,
    case when p_ttl_seconds is not null then now() + (p_ttl_seconds * interval '1 second') else null end,
    now()
  )
  on conflict (agent_id, key) do update
    set value      = excluded.value,
        expires_at = excluded.expires_at,
        updated_at = now();
end;
$$;

revoke all on function public.agent_kv_set from public;


create or replace function public.agent_kv_del(
  p_agent_id uuid,
  p_key      text
)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.agent_kv
   where agent_id = p_agent_id and key = p_key;
$$;

revoke all on function public.agent_kv_del from public;


create or replace function public.agent_kv_list(
  p_agent_id uuid
)
returns table(key text, value text, expires_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select key, value, expires_at
    from public.agent_kv
   where agent_id = p_agent_id
     and (expires_at is null or expires_at > now())
   order by key;
$$;

revoke all on function public.agent_kv_list from public;


-- =====================================================================
-- 5. on_reply trigger
-- =====================================================================
-- A "reply" is a comment with a non-null parent_comment_id.
-- We dispatch to the author of the parent comment, not the mix owner,
-- so the right person gets the 'on_reply' event.

create or replace function public.lua_on_reply()
returns trigger
language plpgsql
security definer
as $$
declare
  v_parent_author uuid;
begin
  -- Only fire for replies, not top-level comments.
  if new.parent_comment_id is null then return new; end if;

  select user_id into v_parent_author
    from public.comments
   where id = new.parent_comment_id;

  -- Skip self-replies.
  if v_parent_author is null or v_parent_author = new.user_id then return new; end if;

  perform public.dispatch_lua_event(
    v_parent_author,
    'on_reply',
    jsonb_build_object(
      'actor_id',        new.user_id,
      'mix_id',          new.mix_id,
      'comment_id',      new.id,
      'parent_id',       new.parent_comment_id,
      'body',            new.body,
      'created_at',      new.created_at
    )
  );
  return new;
end;
$$;

drop trigger if exists on_reply_dispatch_lua on public.comments;
create trigger on_reply_dispatch_lua
  after insert on public.comments
  for each row execute function public.lua_on_reply();


-- =====================================================================
-- 6. pg_cron: hourly sweep of expired KV entries
-- =====================================================================

do $$
declare
  job_id bigint;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    return;  -- pg_cron not yet enabled; skip silently
  end if;
  select jobid into job_id from cron.job where jobname = 'cleanup_expired_agent_kv';
  if job_id is not null then perform cron.unschedule(job_id); end if;
  perform cron.schedule(
    'cleanup_expired_agent_kv',
    '0 * * * *',
    $cron$ delete from public.agent_kv where expires_at < now(); $cron$
  );
end$$;


-- =====================================================================
-- 7. Trim old run logs (keep latest 500 per agent) — maintenance RPC
-- =====================================================================

create or replace function public.trim_lua_agent_runs(p_keep int default 500)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.lua_agent_runs
   where id in (
     select id
       from (
         select id,
                row_number() over (partition by agent_id order by created_at desc) as rn
           from public.lua_agent_runs
       ) ranked
      where rn > p_keep
   );
end;
$$;

revoke all on function public.trim_lua_agent_runs from public;

-- Schedule daily trim at 03:00 UTC.
do $$
declare
  job_id bigint;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then return; end if;
  select jobid into job_id from cron.job where jobname = 'trim_lua_agent_runs_daily';
  if job_id is not null then perform cron.unschedule(job_id); end if;
  perform cron.schedule(
    'trim_lua_agent_runs_daily',
    '0 3 * * *',
    $cron$ select public.trim_lua_agent_runs(500); $cron$
  );
end$$;


commit;

-- Resolves: Phase L+ agent infrastructure (KV store, on_reply, auto-disable, run log trim)
