-- supabase/migrations/20260628_purchase_verify_prior_day.sql
-- ═══════════════════════════════════════════════════════════════════
-- Let kitchen AND front_desk verify a pending_verification item created on a
-- PRIOR day (not just today).
--
-- Symptom: on the kitchen / front-desk client, tapping Accept on a row carried
-- over from a previous day makes it disappear then flicker back and stick — the
-- server rejects the write, so the optimistic removal is rolled back.
--
-- Two independent gaps, confirmed by signing in as each role against a row dated
-- yesterday (owner/manager verify such rows fine — there is no restrictive date
-- policy; the limits live only in the kitchen/front_desk policies):
--
--   1. KITCHEN can't READ prior-day rows. The base SELECT policy
--      (20260616_purchase_ledger.sql) exposes kitchen only to date = today, with
--      no pending_verification exception. Postgres filters an UPDATE's WHERE by
--      the SELECT policy, so the verify UPDATE matches 0 rows. front_desk already
--      has the needed read access (purchase_items_front_desk_select).
--
--   2. The verify UPDATE policy currently in the database carries a date = today
--      condition in its WITH CHECK (drifted from its migration file), so even
--      when the row is readable (front_desk), updating a prior-day row fails the
--      WITH CHECK. Recreate the policy WITHOUT any date restriction: kitchen and
--      front_desk may flip ANY pending_verification row to verified / rejected.
--      (Cost columns are intentionally NOT restricted here — a legitimately
--      purchased row already carries unit_price/total_price, and verification
--      must not be blocked by their presence.)
--
-- No INSERT / DELETE / cost-editing rights are granted. Idempotent.
-- ═══════════════════════════════════════════════════════════════════

-- 1. Kitchen may READ any pending_verification row, regardless of date.
drop policy if exists purchase_items_kitchen_verify_select on public.purchase_items;

create policy purchase_items_kitchen_verify_select on public.purchase_items
  for select to authenticated
  using (
    public.staff_role_is(array['kitchen'])
    and status = 'pending_verification'
  );

-- 2. Kitchen + front_desk may verify/reject any pending_verification row,
--    regardless of date (recreated without the drifted date condition).
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
