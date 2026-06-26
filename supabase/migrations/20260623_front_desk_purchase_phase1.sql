-- Front desk Purchase Phase 1: role-safe row access only.
--
-- Front desk may read:
--   1. any row awaiting verification, so drinks/front-desk items can be accepted/rejected;
--   2. today's rows, so the Received tab can show the current operating day.
--
-- This migration does not grant INSERT, DELETE, cost access, purchase execution,
-- or owner/manager actions. PostgreSQL RLS controls rows rather than columns;
-- server queries must continue selecting staff-safe columns that omit supplier,
-- unit_price, total_price, purchase_method, and payment_status.

begin;

drop policy if exists purchase_items_front_desk_select on public.purchase_items;

create policy purchase_items_front_desk_select on public.purchase_items
  for select to authenticated
  using (
    public.staff_role_is(array['front_desk'])
    and (
      status = 'pending_verification'
      or date = public.kk_today()::text
    )
  );

commit;
