-- Migration 092: Privacy & Compliance (GDPR) — consent records + deletion requests
--
-- WHY: MixHive had no consent management or data-subject-rights surface, a hard
-- blocker for EU/intl launch (GDPR/LGPD/APPI/PIPA). This adds consent logging
-- (Art. 7 records) and an account-deletion request queue (Art. 17, 30-day grace,
-- finalized by an admin/cron step — never an unguarded instant wipe).
--
-- Resolves: Phase 13 (Privacy & Compliance) — card 9969627112

begin;

-- Consent records (Art. 7). user_id null = pre-login/anonymous visitor.
create table if not exists public.user_consents (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade,
  necessary      boolean not null default true,
  analytics      boolean not null default false,
  marketing      boolean not null default false,
  policy_version text not null default 'v1',
  ip             inet,
  user_agent     text,
  created_at     timestamptz not null default now()
);
create index if not exists idx_user_consents_user on public.user_consents(user_id);

-- Account-deletion requests (Art. 17). 30-day grace before finalization.
create table if not exists public.deletion_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  status        text not null default 'requested' check (status in ('requested','processing','done','cancelled')),
  reason        text,
  requested_at  timestamptz not null default now(),
  process_after timestamptz not null default (now() + interval '30 days'),
  unique (user_id, status)
);
create index if not exists idx_deletion_requests_user on public.deletion_requests(user_id);

alter table public.user_consents enable row level security;
alter table public.deletion_requests enable row level security;

-- Consent: anyone may record a consent choice for themselves (anon → null user_id,
-- authenticated → own id); a user may read their own consent history.
drop policy if exists "user_consents_insert" on public.user_consents;
create policy "user_consents_insert" on public.user_consents
  for insert to anon, authenticated
  with check (user_id is null or user_id = (select auth.uid()));

drop policy if exists "user_consents_select_own" on public.user_consents;
create policy "user_consents_select_own" on public.user_consents
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Deletion requests: owner may create + read their own.
drop policy if exists "deletion_requests_insert_own" on public.deletion_requests;
create policy "deletion_requests_insert_own" on public.deletion_requests
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "deletion_requests_select_own" on public.deletion_requests;
create policy "deletion_requests_select_own" on public.deletion_requests
  for select to authenticated
  using (user_id = (select auth.uid()));

commit;

-- Resolves: Phase 13 (Privacy & Compliance) — card 9969627112
