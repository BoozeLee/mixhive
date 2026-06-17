-- Allow a user to cancel their own pending deletion request
-- (needed by /api/account/delete/cancel route which uses user JWT).
begin;

drop policy if exists "deletion_requests_update_own" on public.deletion_requests;
create policy "deletion_requests_update_own"
  on public.deletion_requests
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and status in ('requested', 'cancelled'));

commit;
