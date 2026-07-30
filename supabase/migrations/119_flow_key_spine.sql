-- Migration 119: Flow Key spine (FK-1)
--
-- Non-invasive harvest from a RUNNING ritual. A per-session drain lock
-- (flow_key_taps) guarantees one drain at a time, mirroring a real Flow Hive
-- where one frame drains at a time. Spores are durable, self-verifying
-- artifacts: content_hash is sha256 over the JCS-canonical genome and
-- seal_signature is a detached Ed25519 signature over that hash.
--
-- The capped-cell predicate deliberately lives in TypeScript
-- (src/lib/flow-key/capping.ts) where it is unit-tested; these RPCs own only
-- the atomic lock and the state machine.
--
-- Audio never enters the genome — carbon holds per-asset content digests only.
--
-- Resolves: P7.5 FK-1

begin;

-- ── 0. Asset settle/soft-delete columns the capping predicate needs ─────────
-- default true is correct: every existing row was inserted after its upload
-- completed (097 inserts the row only once storage_path is known).

alter table public.collab_session_assets
  add column if not exists upload_complete boolean not null default true,
  add column if not exists deleted_at timestamptz;

-- ── 1. flow_spores ──────────────────────────────────────────────────────────

create table if not exists public.flow_spores (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.collab_sessions(id) on delete cascade,
  turned_by       uuid not null references public.profiles(id) on delete cascade,
  state           text not null default 'draining'
                    check (state in ('draining','sealed','void')),
  opened_at       timestamptz not null default now(),
  sealed_at       timestamptz,
  generation      int not null default 0,
  parent_hash     text,
  root_session_id uuid references public.collab_sessions(id) on delete set null,
  carbon          jsonb not null default '{}'::jsonb,
  silica          jsonb not null default '{}'::jsonb,
  capped_count    int not null default 0,
  skipped_count   int not null default 0,
  genome_version  int not null default 1,
  content_hash    text,
  seal_signature  text,
  seal_key_id     text,
  storage_path    text,
  created_at      timestamptz not null default now()
);

create unique index if not exists flow_spores_content_hash_idx
  on public.flow_spores (content_hash) where content_hash is not null;
create index if not exists flow_spores_session_idx
  on public.flow_spores (session_id, created_at desc);
create index if not exists flow_spores_turned_by_idx
  on public.flow_spores (turned_by, created_at desc);
-- Drives the reaper.
create index if not exists flow_spores_draining_idx
  on public.flow_spores (opened_at) where state = 'draining';

-- ── 2. flow_key_taps — the drain lock ───────────────────────────────────────

create table if not exists public.flow_key_taps (
  session_id  uuid primary key references public.collab_sessions(id) on delete cascade,
  is_open     boolean not null default false,
  opened_by   uuid references public.profiles(id) on delete set null,
  opened_at   timestamptz,
  drain_lock  uuid references public.flow_spores(id) on delete set null,
  turns_count int not null default 0
);

-- ── 3. flow_spore_contributors ──────────────────────────────────────────────

-- NOTE: ai_agents is keyed by `slug text` (migration 104), not a uuid id, and
-- mix_agent_credits likewise carries agent_slug. Contributors follow that key.

create table if not exists public.flow_spore_contributors (
  id         uuid primary key default gen_random_uuid(),
  spore_id   uuid not null references public.flow_spores(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  agent_slug text references public.ai_agents(slug) on delete set null,
  fraction   text not null check (fraction in ('carbon','silica')),
  role       text not null,
  weight     numeric not null default 0,
  created_at timestamptz not null default now(),
  constraint flow_spore_contributors_subject
    check (profile_id is not null or agent_slug is not null)
);

create unique index if not exists flow_spore_contributors_profile_idx
  on public.flow_spore_contributors (spore_id, profile_id) where profile_id is not null;
create unique index if not exists flow_spore_contributors_agent_idx
  on public.flow_spore_contributors (spore_id, agent_slug) where agent_slug is not null;

-- The bounded ritual agent (097's Session Spirit) is credited as a first-class
-- followable artist, exactly like an AI band member — that is migration 104's
-- premise, and the silica fraction should be attributable, not anonymous.
insert into public.ai_agents (slug, name)
values ('session-spirit', 'Session Spirit')
on conflict (slug) do nothing;

-- ── 4. flow_spore_grants — single-use download tokens (FK-2 extends this) ───

create table if not exists public.flow_spore_grants (
  id              uuid primary key default gen_random_uuid(),
  spore_id        uuid not null references public.flow_spores(id) on delete cascade,
  issued_by       uuid not null references public.profiles(id) on delete cascade,
  grantee_profile uuid references public.profiles(id) on delete cascade,
  rights          text[] not null default array['read']::text[],
  token_hash      text not null unique,
  expires_at      timestamptz not null,
  used_at         timestamptz,
  revoked_at      timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists flow_spore_grants_spore_idx
  on public.flow_spore_grants (spore_id, created_at desc);

-- ── 5. RLS ──────────────────────────────────────────────────────────────────
-- Writes are RPC-only (security definer) or service-role. No client write
-- policies are granted on any table in this migration.

alter table public.flow_spores enable row level security;
alter table public.flow_key_taps enable row level security;
alter table public.flow_spore_contributors enable row level security;
alter table public.flow_spore_grants enable row level security;

drop policy if exists "flow spores visible to turner and contributors" on public.flow_spores;
create policy "flow spores visible to turner and contributors"
  on public.flow_spores for select
  using (
    turned_by = auth.uid()
    or exists (
      select 1 from public.flow_spore_contributors c
      where c.spore_id = flow_spores.id and c.profile_id = auth.uid()
    )
  );

drop policy if exists "flow key tap visible to the room" on public.flow_key_taps;
create policy "flow key tap visible to the room"
  on public.flow_key_taps for select
  using (public.can_view_collab_session(session_id));

drop policy if exists "spore contributors visible to the spore audience" on public.flow_spore_contributors;
create policy "spore contributors visible to the spore audience"
  on public.flow_spore_contributors for select
  using (
    profile_id = auth.uid()
    or exists (
      select 1 from public.flow_spores s
      where s.id = flow_spore_contributors.spore_id and s.turned_by = auth.uid()
    )
  );

drop policy if exists "spore grants visible to issuer and grantee" on public.flow_spore_grants;
create policy "spore grants visible to issuer and grantee"
  on public.flow_spore_grants for select
  using (issued_by = auth.uid() or grantee_profile = auth.uid());

-- ── 6. Graph extensions ─────────────────────────────────────────────────────

alter table public.mythic_nodes drop constraint if exists mythic_nodes_node_type_check;
alter table public.mythic_nodes add constraint mythic_nodes_node_type_check
  check (node_type in (
    'artist_profile','mix','buzz','event','venue','opportunity','promoter',
    'label','curator','quest','agent','collab_session','nft_collection',
    'flow_spore'
  ));

alter table public.mythic_edges drop constraint if exists mythic_edges_edge_type_check;
alter table public.mythic_edges add constraint mythic_edges_edge_type_check
  check (edge_type in (
    'performed_at','booked_by','submitted_to','collab_with','remixed',
    'engaged_with','recommended_by_agent','followed','inspired_by',
    'quest_milestone','yielded_outcome','similar_artist',
    'session_produced_mix','owns_nft_of','backed_by','backed_quest',
    'drained_from','germinated_into'
  ));

-- ── 7. turn_flow_key ────────────────────────────────────────────────────────
-- Atomic: asserts host, asserts no open drain, opens the tap, creates the
-- draining spore, records the visible turn event. The room SEES the turn —
-- that is what makes quiet extraction structurally impossible.

create or replace function public.turn_flow_key(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_spore_id uuid;
  v_now timestamptz := now();
  v_turns int;
begin
  if not public.can_manage_collab_session(p_session_id) then
    raise exception 'Not authorized: only creators can turn the Flow Key'
      using errcode = '42501';
  end if;

  insert into public.flow_key_taps (session_id)
  values (p_session_id)
  on conflict (session_id) do nothing;

  -- Lock the tap row so two simultaneous turns cannot both pass the check.
  perform 1 from public.flow_key_taps where session_id = p_session_id for update;

  if exists (
    select 1 from public.flow_key_taps
    where session_id = p_session_id and is_open
  ) then
    raise exception 'drain_already_open' using errcode = '55006';
  end if;

  insert into public.flow_spores (session_id, turned_by, opened_at, root_session_id)
  values (p_session_id, auth.uid(), v_now, p_session_id)
  returning id into v_spore_id;

  update public.flow_key_taps
     set is_open = true,
         opened_by = auth.uid(),
         opened_at = v_now,
         drain_lock = v_spore_id,
         turns_count = turns_count + 1
   where session_id = p_session_id
  returning turns_count into v_turns;

  insert into public.collab_session_events (session_id, actor_id, event_type, payload)
  values (
    p_session_id, auth.uid(), 'flow_key_turned',
    jsonb_build_object('spore_id', v_spore_id)
  );

  return jsonb_build_object(
    'spore_id', v_spore_id,
    'opened_at', v_now,
    'turns_count', v_turns
  );
end;
$$;

comment on function public.turn_flow_key(uuid) is
  'Opens the Flow Key drain for a session: asserts host permission, takes the single-drain lock, creates a draining flow_spores row, and records a visible flow_key_turned event. Raises 55006 (drain_already_open) if a drain is in progress.';

-- ── 8. seal_flow_spore ──────────────────────────────────────────────────────
-- Service-role only: the genome hash and Ed25519 signature are produced by the
-- server, never by a client.

create or replace function public.seal_flow_spore(
  p_spore_id uuid,
  p_carbon jsonb,
  p_silica jsonb,
  p_content_hash text,
  p_signature text,
  p_key_id text,
  p_storage_path text,
  p_capped int,
  p_skipped int,
  p_contributors jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_sealed_at timestamptz := now();
  v_row jsonb;
begin
  select session_id into v_session_id
    from public.flow_spores
   where id = p_spore_id and state = 'draining'
     for update;

  if v_session_id is null then
    raise exception 'Spore not found or not draining' using errcode = 'P0002';
  end if;

  update public.flow_spores
     set state = 'sealed',
         sealed_at = v_sealed_at,
         carbon = coalesce(p_carbon, '{}'::jsonb),
         silica = coalesce(p_silica, '{}'::jsonb),
         content_hash = p_content_hash,
         seal_signature = p_signature,
         seal_key_id = p_key_id,
         storage_path = p_storage_path,
         capped_count = coalesce(p_capped, 0),
         skipped_count = coalesce(p_skipped, 0)
   where id = p_spore_id;

  insert into public.flow_spore_contributors
    (spore_id, profile_id, agent_slug, fraction, role, weight)
  select
    p_spore_id,
    nullif(c->>'profile_id','')::uuid,
    nullif(c->>'agent_slug',''),
    c->>'fraction',
    c->>'role',
    coalesce((c->>'weight')::numeric, 0)
  from jsonb_array_elements(coalesce(p_contributors, '[]'::jsonb)) as c
  on conflict do nothing;

  update public.flow_key_taps
     set is_open = false, drain_lock = null
   where session_id = v_session_id;

  insert into public.collab_session_events (session_id, actor_id, event_type, payload)
  values (
    v_session_id,
    (select turned_by from public.flow_spores where id = p_spore_id),
    'flow_key_sealed',
    jsonb_build_object('spore_id', p_spore_id, 'content_hash', p_content_hash,
                       'capped', p_capped, 'skipped', p_skipped)
  );

  select to_jsonb(s) into v_row from public.flow_spores s where s.id = p_spore_id;
  return v_row;
end;
$$;

comment on function public.seal_flow_spore(uuid,jsonb,jsonb,text,text,text,text,int,int,jsonb) is
  'Seals a draining spore: writes the carbon/silica fractions, genome hash, Ed25519 signature and storage path, inserts contributor provenance, closes the drain lock, and records flow_key_sealed. Service-role only.';

-- ── 9. revoke_flow_key ──────────────────────────────────────────────────────

create or replace function public.revoke_flow_key(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_spore_id uuid;
begin
  if not public.can_manage_collab_session(p_session_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select drain_lock into v_spore_id
    from public.flow_key_taps
   where session_id = p_session_id and is_open
     for update;

  if v_spore_id is null then
    return jsonb_build_object('revoked', false);
  end if;

  update public.flow_spores set state = 'void' where id = v_spore_id;
  update public.flow_key_taps
     set is_open = false, drain_lock = null
   where session_id = p_session_id;

  insert into public.collab_session_events (session_id, actor_id, event_type, payload)
  values (p_session_id, auth.uid(), 'flow_key_revoked',
          jsonb_build_object('spore_id', v_spore_id));

  return jsonb_build_object('revoked', true, 'spore_id', v_spore_id);
end;
$$;

comment on function public.revoke_flow_key(uuid) is
  'Host kills an open drain: voids the draining spore and closes the tap.';

-- ── 10. reap_stale_flow_drains ──────────────────────────────────────────────
-- A session must never be left with a stuck-open key.

create or replace function public.reap_stale_flow_drains()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
begin
  with stale as (
    select id, session_id from public.flow_spores
     where state = 'draining' and opened_at < now() - interval '15 minutes'
  ), voided as (
    update public.flow_spores s set state = 'void'
      where s.id in (select id from stale)
      returning s.id, s.session_id
  ), closed as (
    update public.flow_key_taps t
       set is_open = false, drain_lock = null
     where t.session_id in (select session_id from voided)
     returning t.session_id
  )
  select count(*) into v_count from voided;

  return v_count;
end;
$$;

comment on function public.reap_stale_flow_drains() is
  'Cron: voids draining spores older than 15 minutes and closes their taps so a session is never left with a stuck-open Flow Key.';

revoke all on function public.seal_flow_spore(uuid,jsonb,jsonb,text,text,text,text,int,int,jsonb) from anon, authenticated;
revoke all on function public.reap_stale_flow_drains() from anon, authenticated;

-- ── 11. Private storage bucket for spore documents ──────────────────────────

insert into storage.buckets (id, name, public)
values ('flow-spores', 'flow-spores', false)
on conflict (id) do nothing;

commit;

-- Resolves: P7.5 FK-1 (Flow Key spine)
