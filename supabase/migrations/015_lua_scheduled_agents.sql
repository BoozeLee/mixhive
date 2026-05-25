-- Migration 015: scheduled Lua agents via pg_cron
--
-- Agents with trigger_type = 'on_schedule' carry a 5-field cron_expr
-- (e.g. '0 9 * * 1' for Mondays at 09:00). A single pg_cron job runs
-- every minute and calls run_due_lua_agents(), which inspects each
-- scheduled agent and dispatches the ones whose cron_expr matches the
-- current minute.
--
-- We do the cron matching in Postgres (rather than letting pg_cron own
-- per-agent jobs) so that:
--   * users can change cron_expr without DBA help
--   * disabling an agent is a single UPDATE, not a cron.unschedule()
--   * the audit trail (lua_agent_runs) stays the single source of truth
--
-- Resolves: trigger_type='on_schedule' arm of Phase L+.

begin;

-- Hard guard: pg_cron must be enabled. Migration 008 (mix-scores cron)
-- already required this. Surface a clear error so the operator knows
-- where to look.
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise exception
      'pg_cron extension is not enabled. Enable it in the Supabase dashboard (Database → Extensions) before applying this migration.';
  end if;
end$$;


-- Tiny cron matcher. Returns true when `now()` (rounded to the minute)
-- matches the given expression. Supports '*', single integers, ranges
-- (1-5), step (*/15), and comma lists (1,3,5). No nicknames (@daily etc.)
-- — keeps the matcher small and predictable.
create or replace function public.cron_matches(p_expr text, p_now timestamptz default now())
returns boolean
language plpgsql
immutable
as $$
declare
  v_parts   text[];
  v_minute  int := extract(minute  from p_now)::int;
  v_hour    int := extract(hour    from p_now)::int;
  v_dom     int := extract(day     from p_now)::int;
  v_month   int := extract(month   from p_now)::int;
  v_dow     int := extract(dow     from p_now)::int;   -- 0=Sun
  v_value   int;
  v_field   text;
  v_field_idx int;
  v_token   text;
  v_match   boolean;
  v_lo      int;
  v_hi      int;
  v_step    int;
begin
  if p_expr is null or btrim(p_expr) = '' then return false; end if;
  v_parts := regexp_split_to_array(btrim(p_expr), '\s+');
  if array_length(v_parts, 1) <> 5 then return false; end if;

  for v_field_idx in 1..5 loop
    v_field := v_parts[v_field_idx];
    case v_field_idx
      when 1 then v_value := v_minute;
      when 2 then v_value := v_hour;
      when 3 then v_value := v_dom;
      when 4 then v_value := v_month;
      when 5 then v_value := v_dow;
    end case;

    v_match := false;
    foreach v_token in array string_to_array(v_field, ',') loop
      v_step := 1;
      if position('/' in v_token) > 0 then
        v_step := nullif(split_part(v_token, '/', 2), '')::int;
        v_token := split_part(v_token, '/', 1);
      end if;
      if v_token = '*' then
        v_lo := case v_field_idx when 1 then 0 when 2 then 0 when 3 then 1 when 4 then 1 else 0 end;
        v_hi := case v_field_idx when 1 then 59 when 2 then 23 when 3 then 31 when 4 then 12 else 6 end;
      elsif position('-' in v_token) > 0 then
        v_lo := split_part(v_token, '-', 1)::int;
        v_hi := split_part(v_token, '-', 2)::int;
      else
        v_lo := v_token::int;
        v_hi := v_lo;
      end if;
      if v_value between v_lo and v_hi and ((v_value - v_lo) % v_step) = 0 then
        v_match := true;
        exit;
      end if;
    end loop;

    if not v_match then return false; end if;
  end loop;

  return true;
end;
$$;


-- Per-minute dispatcher. Called by pg_cron.
create or replace function public.run_due_lua_agents()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent record;
  v_now   timestamptz := date_trunc('minute', now());
begin
  for v_agent in
    select id, owner_id, cron_expr, timeout_ms
      from public.lua_agents
     where enabled = true
       and trigger_type = 'on_schedule'
       and cron_expr is not null
       and (last_run_at is null or last_run_at < v_now)
  loop
    if public.cron_matches(v_agent.cron_expr, v_now) then
      perform public.dispatch_lua_event(
        v_agent.owner_id,
        'on_schedule',
        jsonb_build_object('tick_at', v_now, 'cron', v_agent.cron_expr)
      );
    end if;
  end loop;
end;
$$;


-- Schedule the dispatcher. Idempotent — drop the previous schedule first.
do $$
declare
  job_id bigint;
begin
  select jobid into job_id from cron.job where jobname = 'run_due_lua_agents_every_minute';
  if job_id is not null then perform cron.unschedule(job_id); end if;
end$$;

select cron.schedule(
  'run_due_lua_agents_every_minute',
  '* * * * *',
  $cron$ select public.run_due_lua_agents(); $cron$
);

commit;
