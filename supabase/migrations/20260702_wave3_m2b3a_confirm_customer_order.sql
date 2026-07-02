-- ============================================================================
-- Wave 3 · Ordering Backend · M2B3A — staff confirmation scaffold
-- public.confirm_customer_order(bigint)
-- ----------------------------------------------------------------------------
-- Adds the staff-side confirmation entry point for customer-submitted orders.
-- A staff member (owner / manager / front_desk) confirms a pending
-- customer_app order, which advances it to the EXISTING terminal fulfillment
-- state and stamps who/when:
--
--     status       pending -> completed          (existing status model)
--     confirmed_by NULL    -> auth.uid()         (the confirming staff)
--     confirmed_at NULL    -> now()
--
-- STATUS MODEL (locked by PRECHECK): bento_orders has NO status CHECK
-- constraint; the live/app flow is {pending, completed, canceled}, and
-- public.set_bento_order_status only permits {pending, completed}. M2B3A does
-- NOT introduce a 'confirmed' status — it reuses 'completed' so existing
-- staff/customer UI filtering keeps working.
--
-- SCOPE (M2B3A) — CONFIRMATION SCAFFOLD ONLY. This function:
--   * does NOT touch order_kind / unit_price / delivery_fee / amount (M2B2 pricing
--     outputs are preserved untouched — the UPDATE lists only status/confirmed_*).
--   * does NOT update bento_customers.used_portions.
--   * does NOT write bento_meal_ledger.
--   * does NOT change credits_deducted (stays as-is; deduction is M2B3B).
--   * does NOT modify create_customer_order_request.
--   * does NOT modify set_bento_order_status.
--   * does NOT alter the bento_orders.status model.
-- Package deduction on this confirmation path is M2B3B; cancel/reversal is M2B3C.
--
-- Idempotent DDL (create or replace). Reversible (drop — SECTION 4). New
-- function, so grants are asserted explicitly. Run sections manually in the
-- Supabase SQL Editor (staging first). Only APPLY changes state (it creates a
-- function; it inserts/updates no rows outside the optional rollback'd smoke test).
-- ============================================================================


-- ============================================================================
-- SECTION 1 · PRECHECK  (READ-ONLY)
-- ============================================================================

-- 1.1 the function does NOT already exist  (expect: null)
select to_regprocedure('public.confirm_customer_order(bigint)') as rpc_regprocedure;

-- 1.2 target stamp columns present + nullable  (expect: confirmed_by uuid YES,
--     confirmed_at timestamp/timestamptz YES)
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema='public' and table_name='bento_orders'
  and column_name in ('confirmed_by','confirmed_at','source','status','credits_deducted')
order by column_name;

-- 1.3 still NO status CHECK constraint on bento_orders  (expect: 0 rows) — the
--     gate that lets us set status='completed' without a value-domain violation.
select conname, pg_get_constraintdef(oid) as def
from pg_constraint
where conrelid='public.bento_orders'::regclass and contype='c'
  and pg_get_constraintdef(oid) ilike '%status%';

-- 1.4 confirmed_by FK target  (expect: references public.staff_profiles(id), if any)
select conname, pg_get_constraintdef(oid) as def
from pg_constraint
where conrelid='public.bento_orders'::regclass and contype='f'
  and pg_get_constraintdef(oid) ilike '%confirmed_by%';

-- 1.5 staff auth helper present  (expect: not null)
select to_regprocedure('public.staff_role_is(text[])') as staff_role_is_fn;

-- 1.6 no trigger blocks/overwrites a plain status/confirmed_* update  (expect:
--     only the existing audit AFTER trigger)
select t.tgname, pg_get_triggerdef(t.oid) as def
from pg_trigger t
join pg_class c on c.oid=t.tgrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='bento_orders' and not t.tgisinternal
order by t.tgname;


-- ============================================================================
-- SECTION 2 · APPLY  (CREATE FUNCTION + GRANTS — no data rows changed)
-- ============================================================================

begin;

create or replace function public.confirm_customer_order(
  p_order_id bigint
)
returns public.bento_orders
language plpgsql
security definer
set search_path = public, auth
as $fn$
declare
  v_order public.bento_orders%rowtype;
begin
  -- (a) staff gate — only fulfillment-authorised roles may confirm.
  --     staff_role_is() resolves the caller via auth.uid() = staff_profiles.id
  --     and validates the session; it returns false for anon/invalid sessions.
  if not public.staff_role_is(array['owner', 'manager', 'front_desk']) then
    raise exception 'Order confirmation access required'
      using errcode = 'insufficient_privilege';
  end if;

  -- (b) lock the target row for the life of the transaction (serialises against
  --     concurrent confirmations; required for the M2B3B deduction path later).
  select *
    into v_order
    from public.bento_orders
   where id = p_order_id
   for update;

  if not found then
    raise exception 'Bento order not found'
      using errcode = 'no_data_found';
  end if;

  -- (c) this entry point confirms customer-submitted orders only.
  if v_order.source is distinct from 'customer_app' then
    raise exception 'Only customer app orders can be confirmed here'
      using errcode = 'check_violation';
  end if;

  -- (d) only a pending order can be confirmed (guards double-confirm / terminal
  --     states such as completed or canceled).
  if v_order.status is distinct from 'pending' then
    raise exception 'Order is not pending confirmation (current status: %)', v_order.status
      using errcode = 'check_violation';
  end if;

  -- (e) advance to the EXISTING terminal state + stamp who/when. ONLY these three
  --     columns are written: order_kind / unit_price / delivery_fee / amount and
  --     credits_deducted are deliberately untouched (M2B2 pricing preserved; no
  --     deduction — that is M2B3B).
  update public.bento_orders
     set status       = 'completed',
         confirmed_by = auth.uid(),
         confirmed_at = now()
   where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$fn$;

comment on function public.confirm_customer_order(bigint) is
  'Wave 3 M2B3A: staff confirmation scaffold. owner/manager/front_desk confirm a '
  'source=customer_app, status=pending order: locks the row FOR UPDATE, advances '
  'status pending->completed (existing status model; no ''confirmed'' state), sets '
  'confirmed_by=auth.uid() and confirmed_at=now(), returns the updated row. Leaves '
  'M2B2 pricing (order_kind/unit_price/delivery_fee/amount) and credits_deducted '
  'unchanged. No ledger, no used_portions, no package deduction (that is M2B3B). '
  'SECURITY DEFINER; authenticated + staff-gated.';

-- Assert execute scope (new function; explicit for safety — mirrors
-- set_bento_order_status: role enforcement is inside the function, not RLS).
revoke all on function public.confirm_customer_order(bigint) from public, anon;
grant execute on function public.confirm_customer_order(bigint) to authenticated;

commit;


-- ============================================================================
-- SECTION 3 · POSTCHECK  (3.1–3.4 READ-ONLY)
-- ============================================================================

-- 3.1 function now exists  (expect: not null)
select to_regprocedure('public.confirm_customer_order(bigint)') as rpc_regprocedure;

-- 3.2 security pattern  (expect: security_definer=true; search_path=public, auth)
select p.proname, p.prosecdef as security_definer, p.proconfig as settings,
       (select rolname from pg_roles where oid = p.proowner) as owner
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public' and p.proname='confirm_customer_order';

-- 3.3 grants  (expect: auth_exec=true, anon_exec=false)
select
  has_function_privilege('authenticated','public.confirm_customer_order(bigint)','EXECUTE') as auth_exec,
  has_function_privilege('anon','public.confirm_customer_order(bigint)','EXECUTE') as anon_exec,
  has_function_privilege('service_role','public.confirm_customer_order(bigint)','EXECUTE') as service_role_exec;

-- 3.4 inspect body: expect gate staff_role_is(['owner','manager','front_desk']);
--     FOR UPDATE lock; source='customer_app' + status='pending' guards; UPDATE sets
--     ONLY status/confirmed_by/confirmed_at; NO ledger / used_portions /
--     credits_deducted / pricing columns.
select pg_get_functiondef('public.confirm_customer_order(bigint)'::regprocedure) as function_definition;

-- 3.5 OPTIONAL transactional smoke test — MUST ROLLBACK. Run on STAGING as a real
--     authenticated staff session (SQL Editor auth.uid() is NULL -> hits the gate).
--   -- pick a pending customer_app order id, then:
--   begin;
--     select id, status, confirmed_by, confirmed_at, order_kind, unit_price,
--            delivery_fee, amount, credits_deducted
--       from (select (public.confirm_customer_order(<pending_customer_app_id>)).*) r;
--     -- expect: status='completed'; confirmed_by=<staff uuid>; confirmed_at set;
--     --         order_kind/unit_price/delivery_fee/amount UNCHANGED (M2B2 values);
--     --         credits_deducted UNCHANGED (still false).
--   rollback;   -- REQUIRED: discard the smoke-test change
--   -- Negative checks (each in its own begin/rollback):
--   --   * a status<>'pending' order  -> 'Order is not pending confirmation ...'
--   --   * a source<>'customer_app' order -> 'Only customer app orders ...'
--   --   * a non-staff / anon session -> 'Order confirmation access required'


-- ============================================================================
-- SECTION 4 · MANUAL ROLLBACK  (NOT executed by this file)
-- ============================================================================
-- M2B3A only adds a function (no schema/data change beyond the function object).
-- To revert:
--
--   drop function if exists public.confirm_customer_order(bigint);
--
-- No backfill or data repair is required: this function performs the same
-- status transition (pending->completed) that staff already perform today via
-- public.set_bento_order_status; the only added effect is stamping
-- confirmed_by/confirmed_at, which are otherwise NULL.
-- ============================================================================
