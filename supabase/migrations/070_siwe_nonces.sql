-- Migration 070: SIWE nonce table for replay-attack protection
--
-- Stores single-use nonces issued by GET /api/wallet/nonce.
-- Each nonce has a 1-hour TTL enforced by expires_at.
-- POST /api/wallet/connect deletes the nonce on successful signature
-- verification, preventing replay attacks.
--
-- Cleanup of expired rows runs via the existing daily /api/cleanup cron.
-- No client-side access is permitted — all reads/writes use service role.
--
-- Resolves: Phase 8 doc 34 (wallet integration — SIWE nonce replay protection)

begin;

create table if not exists public.siwe_nonces (
  nonce       text        not null primary key,
  user_id     uuid        references auth.users(id) on delete cascade,
  expires_at  timestamptz not null default (now() + interval '1 hour'),
  created_at  timestamptz not null default now()
);

create index if not exists idx_siwe_nonces_expires_at
  on public.siwe_nonces (expires_at);

-- All access goes through server-side routes (service-role key).
-- No anon or authenticated client should read or write nonces directly.
alter table public.siwe_nonces enable row level security;

drop policy if exists "deny_all_client_access" on public.siwe_nonces;
create policy "deny_all_client_access"
  on public.siwe_nonces
  for all
  using (false);

commit;

-- Resolves: Phase 8 doc 34 SIWE nonce replay protection
