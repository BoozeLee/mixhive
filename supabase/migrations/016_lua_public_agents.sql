-- Migration 016: public Lua agents + forking
--
-- Lets users publish an agent so others can preview the code and
-- one-click fork a copy into their own account. The original stays
-- read-only; the fork is independent.
--
-- Resolves: public-sharing arm of Phase L+.

begin;

alter table public.lua_agents
  add column if not exists is_public boolean not null default false,
  add column if not exists fork_of   uuid    references public.lua_agents(id) on delete set null,
  add column if not exists fork_count int    not null default 0;

create index if not exists idx_lua_agents_public
  on public.lua_agents(is_public, updated_at desc)
  where is_public = true;


-- Anyone can SELECT public agents (read-only). The existing "Users
-- manage own agents" policy still applies for owner-private rows.
drop policy if exists "Public agents are readable" on public.lua_agents;
create policy "Public agents are readable"
  on public.lua_agents for select
  using (is_public = true);


-- One-call fork helper. Copies code + description into a new row owned
-- by auth.uid(), bumps fork_count on the original, and returns the new
-- agent's id.
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
    enabled, timeout_ms, memory_kb, fork_of
  )
  values (
    auth.uid(),
    v_name,
    v_source.description,
    v_source.trigger_type,
    v_source.cron_expr,
    v_source.lua_code,
    false,  -- forks start disabled; user must review and enable
    v_source.timeout_ms,
    v_source.memory_kb,
    v_source.id
  )
  returning id into v_new_id;

  update public.lua_agents
     set fork_count = fork_count + 1
   where id = v_source.id;

  return v_new_id;
end;
$$;

commit;
