-- Allow kitchen and front_desk to accept/reject any pending_verification purchase item.
-- This is a targeted verification-only permission; all other purchase management rights
-- (insert, delete, editing cost columns, viewing history) are unchanged.
--
-- The existing purchase_items_update policy lets kitchen update only their OWN rows today.
-- That policy is kept intact for checklist-completion writes. This new policy adds a
-- separate permissive path that lets kitchen AND front_desk flip any
-- pending_verification row to verified or rejected — regardless of who created it.
--
-- using  → row must currently be in pending_verification state (prevents touching other rows)
-- with check → final state must be verified or rejected (prevents other status manipulation)

drop policy if exists purchase_items_verify on public.purchase_items;

create policy purchase_items_verify on public.purchase_items
  for update to authenticated
  using (
    public.staff_role_is(array['kitchen', 'front_desk'])
    and status = 'pending_verification'
  )
  with check (
    public.staff_role_is(array['kitchen', 'front_desk'])
    and status in ('verified', 'rejected')
  );
