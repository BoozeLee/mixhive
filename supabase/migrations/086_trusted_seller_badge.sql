-- Phase 3 (Trust) — Trusted-Seller badge + verification notifications.
--
-- 1. Adds a 'trusted_seller' badge type to verification_badges.
-- 2. Auto-grants it after N dispute-free, released gear sales via an AFTER UPDATE
--    trigger on equipment_transactions (covers both the buyer-confirm endpoint and
--    the auto-release cron — the single choke-point is transaction_state -> 'released').
-- 3. Notifies users when a verification request is approved/rejected, and when the
--    trusted-seller badge is auto-granted (previously only an analytics_events row was
--    written and the notifications type CHECK had no 'verification' value).
-- Idempotent: the unique index uq_verification_badges_profile_type makes grants safe to
-- repeat, and the backfill at the bottom uses the same guarded path.

-- ===== 1. Allow the new badge type =====
alter table public.verification_badges
  drop constraint if exists verification_badges_badge_type_check;
alter table public.verification_badges
  add constraint verification_badges_badge_type_check
    check (badge_type in ('verified', 'artist', 'official', 'trusted_seller'));

-- ===== 2. Allow 'verification' notifications =====
alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
    check (type = any (array[
      'like'::text,
      'follow'::text,
      'comment'::text,
      'reply'::text,
      'mix_upload'::text,
      'mention'::text,
      'buzz_like'::text,
      'repost'::text,
      'verification'::text
    ]));

-- ===== 3. Trusted-seller threshold =====
-- A "dispute-free completed sale" = an equipment_transactions row that reached
-- transaction_state='released' and was never disputed (dispute_opened_at is null).
create or replace function public.maybe_grant_trusted_seller(p_seller uuid)
returns void as $$
declare
  v_min_sales constant int := 3;  -- TRUSTED_SELLER_MIN_SALES
  v_count int;
  v_inserted boolean := false;
begin
  if p_seller is null then
    return;
  end if;

  select count(*) into v_count
  from public.equipment_transactions
  where seller_profile_id = p_seller
    and transaction_state = 'released'
    and dispute_opened_at is null;

  if v_count < v_min_sales then
    return;
  end if;

  insert into public.verification_badges (profile_id, badge_type, label, reason, granted_by)
  values (
    p_seller,
    'trusted_seller',
    'Trusted Seller',
    'auto: ' || v_count || ' dispute-free sales',
    null
  )
  on conflict (profile_id, badge_type) do nothing;

  get diagnostics v_count = row_count;  -- reuse var: rows inserted (0 or 1)
  v_inserted := v_count > 0;

  -- Notify the seller only on first grant (insert actually happened).
  if v_inserted then
    insert into public.notifications (user_id, type, data)
    values (
      p_seller,
      'verification',
      jsonb_build_object('badge_type', 'trusted_seller', 'status', 'approved')
    );
  end if;
end;
$$ language plpgsql security definer;

-- ===== 4. Trigger: fire on transition into 'released' =====
create or replace function public.trg_trusted_seller_on_release()
returns trigger as $$
begin
  if new.transaction_state = 'released'
     and (old.transaction_state is distinct from 'released')
     and new.dispute_opened_at is null then
    perform public.maybe_grant_trusted_seller(new.seller_profile_id);
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trusted_seller_on_release on public.equipment_transactions;
create trigger trusted_seller_on_release
  after update of transaction_state on public.equipment_transactions
  for each row
  execute function public.trg_trusted_seller_on_release();

-- ===== 5. Notify on verification approve/reject =====
-- CREATE OR REPLACE of the existing RPC (migration 017): keep all prior behavior and
-- add a notification to the requesting user on both outcomes.
create or replace function public.review_verification_request(
  p_request_id uuid,
  p_reviewer_id uuid,
  p_status text,
  p_reason text default null,
  p_badge_type text default null
) returns void as $$
declare
  v_request public.verification_requests%rowtype;
  v_is_admin boolean;
  v_badge text;
begin
  select coalesce(is_admin, false) into v_is_admin
  from public.profiles
  where id = p_reviewer_id;

  if not coalesce(v_is_admin, false) then
    raise exception 'Only admins can review verification requests';
  end if;

  select * into v_request
  from public.verification_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Verification request not found';
  end if;

  if p_status not in ('approved', 'rejected') then
    raise exception 'Invalid verification status';
  end if;

  update public.verification_requests
  set
    status = p_status,
    rejection_reason = case when p_status = 'rejected' then p_reason else null end,
    reviewed_by = p_reviewer_id,
    reviewed_at = now(),
    updated_at = now()
  where id = p_request_id;

  if p_status = 'approved' then
    v_badge := coalesce(p_badge_type, v_request.requested_badge, 'verified');

    insert into public.verification_badges (profile_id, badge_type, label, reason, granted_by)
    values (
      v_request.profile_id,
      v_badge,
      case v_badge
        when 'official' then 'Official'
        when 'artist' then 'Artist'
        else 'Verified'
      end,
      p_reason,
      p_reviewer_id
    )
    on conflict (profile_id, badge_type)
    do update set
      reason = excluded.reason,
      granted_by = excluded.granted_by,
      granted_at = now();

    update public.profiles
    set verified = true, updated_at = now()
    where id = v_request.profile_id;

    insert into public.analytics_events (profile_id, actor_id, event_type, metadata)
    values (
      v_request.profile_id,
      p_reviewer_id,
      'verification',
      jsonb_build_object('badge_type', v_badge, 'request_id', p_request_id)
    );
  end if;

  -- Notify the requester of the outcome (approve or reject).
  insert into public.notifications (user_id, type, actor_id, data)
  values (
    v_request.profile_id,
    'verification',
    p_reviewer_id,
    jsonb_build_object(
      'status', p_status,
      'badge_type', case when p_status = 'approved' then coalesce(v_badge, v_request.requested_badge) else null end,
      'rejection_reason', case when p_status = 'rejected' then p_reason else null end,
      'request_id', p_request_id
    )
  );
end;
$$ language plpgsql security definer;

-- ===== 6. Backfill: grant to sellers already over the threshold =====
do $$
declare
  r record;
begin
  for r in
    select seller_profile_id
    from public.equipment_transactions
    where transaction_state = 'released' and dispute_opened_at is null
    group by seller_profile_id
    having count(*) >= 3
  loop
    perform public.maybe_grant_trusted_seller(r.seller_profile_id);
  end loop;
end $$;
