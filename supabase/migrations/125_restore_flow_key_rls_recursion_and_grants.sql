-- ─────────────────────────────────────────────────────────────────────────────
-- 125 — Restore Flow Key RLS + restrict RPC grants
--
-- Merged 119 shipped two defects that only surface at runtime:
--
--   1. RLS infinite recursion (42P17). The SELECT policies on flow_spores,
--      flow_spore_contributors and flow_spore_germinations reference each
--      other's tables through `exists (...)`. Postgres rejects the cycle and
--      every anonymous/authenticated read of those tables 500s. The fix is the
--      standard Supabase pattern: move the cross-table visibility check into a
--      security-definer helper (runs as owner, bypasses RLS) and have the
--      policy call the helper — no cycle, same result.
--
--   2. Default PUBLIC EXECUTE leaks. 119/121/122 revoked anon/authenticated on
--      the RPCs, but a function's default ACL also carries a PUBLIC grant
--      (=X/postgres) that `revoke ... from anon, authenticated` does not touch.
--      has_function_privilege('anon') therefore remained true for every Flow
--      Key RPC — including service-role-only seal_flow_spore and
--      reap_stale_flow_drains, which have no internal auth guard. This restores
--      the intended capability model: service-role-only writers, and client
--      RPCs restricted to authenticated.
--
-- Additive and idempotent; safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Security-definer visibility helpers ───────────────────────────────────
-- Mirrors can_view_collab_session (097). The helper body queries the target
-- tables as the function owner, so RLS is not re-evaluated and no recursion is
-- possible. auth.uid() still resolves to the calling user inside the helper.

create or replace function public.can_view_flow_spore(p_spore_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.flow_spores s
    where s.id = p_spore_id
      and (
        s.turned_by = auth.uid()
        or exists (
          select 1 from public.flow_spore_contributors c
          where c.spore_id = s.id and c.profile_id = auth.uid()
        )
      )
  );
$$;

create or replace function public.can_view_flow_spore_contributor(p_contributor_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.flow_spore_contributors c
    join public.flow_spores s on s.id = c.spore_id
    where c.id = p_contributor_id
      and (
        c.profile_id = auth.uid()
        or s.turned_by = auth.uid()
      )
  );
$$;

create or replace function public.can_view_flow_spore_germination(p_germination_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.flow_spore_germinations g
    join public.flow_spores s on s.id = g.spore_id
    where g.id = p_germination_id
      and (
        g.germinated_by = auth.uid()
        or s.turned_by = auth.uid()
      )
  );
$$;

-- The helpers are evaluated inside RLS policies for anon and authenticated, so
-- both need EXECUTE; service_role keeps it for completeness. No public grant.
revoke all on function public.can_view_flow_spore(uuid) from public;
revoke all on function public.can_view_flow_spore_contributor(uuid) from public;
revoke all on function public.can_view_flow_spore_germination(uuid) from public;
grant execute on function public.can_view_flow_spore(uuid) to anon, authenticated, service_role;
grant execute on function public.can_view_flow_spore_contributor(uuid) to anon, authenticated, service_role;
grant execute on function public.can_view_flow_spore_germination(uuid) to anon, authenticated, service_role;

-- ── 2. Rewrite the recursive SELECT policies to use the helpers ──────────────

drop policy if exists "flow spores visible to turner and contributors" on public.flow_spores;
create policy "flow spores visible to turner and contributors"
  on public.flow_spores for select
  using (public.can_view_flow_spore(id));

drop policy if exists "spore contributors visible to the spore audience" on public.flow_spore_contributors;
create policy "spore contributors visible to the spore audience"
  on public.flow_spore_contributors for select
  using (public.can_view_flow_spore_contributor(id));

drop policy if exists "germinations visible to germinator and spore owner" on public.flow_spore_germinations;
create policy "germinations visible to germinator and spore owner"
  on public.flow_spore_germinations for select
  using (public.can_view_flow_spore_germination(id));

-- ── 3. Restrict RPC grants ───────────────────────────────────────────────────
-- Service-role-only writers: the public grant is removed; the Supabase default
-- ACL still carries an explicit service_role grant, and the app calls these
-- through createServerClient()/cron with the service-role key.

revoke all on function public.seal_flow_spore(uuid,jsonb,jsonb,text,text,text,text,int,int,jsonb) from public;
revoke all on function public.reap_stale_flow_drains() from public;
revoke all on function public.record_flow_spore_anchor(date,text,int,jsonb) from public;
revoke all on function public.record_flow_spore_countersignature(uuid,uuid,text,text) from public;

-- Client RPCs: authenticated only — kill both the public grant (never revoked
-- before) and the inherited anon path, then re-assert authenticated.

revoke all on function public.turn_flow_key(uuid) from public, anon;
grant execute on function public.turn_flow_key(uuid) to authenticated;

revoke all on function public.revoke_flow_key(uuid) from public, anon;
grant execute on function public.revoke_flow_key(uuid) to authenticated;

revoke all on function public.germinate_flow_spore(uuid,text,uuid) from public;
grant execute on function public.germinate_flow_spore(uuid,text,uuid) to authenticated;

revoke all on function public.can_germinate_flow_spore(uuid) from public, anon;
grant execute on function public.can_germinate_flow_spore(uuid) to authenticated;

revoke all on function public.delegate_flow_spore_grant(uuid,uuid,text[],text,timestamptz) from public;
grant execute on function public.delegate_flow_spore_grant(uuid,uuid,text[],text,timestamptz) to authenticated;

revoke all on function public.revoke_flow_spore_grant(uuid) from public;
grant execute on function public.revoke_flow_spore_grant(uuid) to authenticated;

-- Awaiting-anchor is read-only and was granted to authenticated by 122; keep
-- that, but drop the anonymous/public paths.

revoke all on function public.flow_spores_awaiting_anchor(date) from public, anon;
grant execute on function public.flow_spores_awaiting_anchor(date) to authenticated;
