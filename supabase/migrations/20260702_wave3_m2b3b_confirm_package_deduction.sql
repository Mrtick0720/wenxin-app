-- ============================================================================
-- Wave 3 · Ordering Backend · M2B3B — package deduction on confirmation
-- public.confirm_customer_order(bigint)  [create or replace]
-- ----------------------------------------------------------------------------
-- Extends the M2B3A confirmation scaffold. On staff confirmation of a
-- customer_app order, this milestone adds — for PACKAGE orders only — an atomic
-- portion deduction plus a consumption audit-ledger entry, inside the SAME
-- transaction as the confirmation:
--
--     package order  : status pending->completed, confirmed_by/at stamped,
--                       used_portions += quantity, ONE consumption ledger row,
--                       credits_deducted -> true
--     single/corporate: status pending->completed, confirmed_by/at stamped,
--                       NO used_portions change, NO ledger, credits_deducted
--                       stays false  (unchanged M2B3A behaviour)
--
-- AUTHORITY (locked): bento_customers.total_portions/used_portions/opening_offset
-- remain the source of truth. bento_meal_ledger is the append-only audit trail;
-- fn_write_meal_ledger_entry is ledger-only (it does NOT touch used_portions).
--
-- STAFF GATE: owner/manager/front_desk may confirm; PACKAGE confirmation is
-- restricted to owner/manager, because fn_write_meal_ledger_entry is
-- owner/manager-gated internally. front_desk may still confirm single/corporate
-- customer_app orders.
--
-- SCOPE (M2B3B) — deduction on confirmation ONLY. This migration:
--   * modifies ONLY public.confirm_customer_order(bigint).
--   * does NOT modify create_customer_order_request or M2B2 pricing logic.
--   * does NOT modify or re-grant fn_write_meal_ledger_entry.
--   * contains NO cancel/reversal/refund logic (that is M2B3C).
--   * makes NO frontend changes.
-- M2B2 pricing (order_kind/unit_price/delivery_fee/amount) is preserved: no write
-- path touches those columns.
--
-- Idempotent DDL (create or replace). Reversible (re-apply the M2B3A body —
-- SECTION 4). Signature unchanged; create or replace preserves grants
-- (re-asserted below). Run sections manually in the Supabase SQL Editor
-- (staging first). Only APPLY changes state (it replaces a function).
-- ============================================================================


-- ============================================================================
-- SECTION 1 · PRECHECK  (READ-ONLY)
-- ============================================================================

-- 1.1 the function to replace exists  (expect: not null)
select to_regprocedure('public.confirm_customer_order(bigint)') as rpc_regprocedure;

-- 1.2 ledger writer exists with the confirmed 10-arg signature  (expect: not null)
select to_regprocedure(
  'public.fn_write_meal_ledger_entry(integer,text,integer,text,text,bigint,bigint,integer,text,jsonb)'
) as ledger_writer;

-- 1.3 ledger idempotency + delta/consumption rules  (expect: unique event_key
--     index; delta<>0 check; entry_type CHECK allows 'consumption'; source CHECK
--     allows 'customer_app')
select conname, contype, pg_get_constraintdef(oid) as def
from pg_constraint where conrelid='public.bento_meal_ledger'::regclass order by contype;
select indexname, indexdef from pg_indexes
where schemaname='public' and tablename='bento_meal_ledger' and indexdef ilike '%event_key%';

-- 1.4 balance columns present + no negative-blocking gotchas  (expect:
--     total_portions/used_portions/opening_offset integer NOT NULL)
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema='public' and table_name='bento_customers'
  and column_name in ('total_portions','used_portions','opening_offset','active_package_code')
order by column_name;

-- 1.5 confirm NO live trigger auto-adjusts used_portions/ledger on bento_orders
--     (expect: only the write_operational_audit AFTER trigger; sync_bento_flexible_credits gone)
select t.tgname, pg_get_triggerdef(t.oid) as def
from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='bento_orders' and not t.tgisinternal
order by t.tgname;
select to_regprocedure('public.sync_bento_flexible_credits()') as legacy_trigger_fn;  -- expect null


-- ============================================================================
-- SECTION 2 · APPLY  (REPLACE FUNCTION + reassert GRANTS — no rows changed)
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
  v_order            public.bento_orders%rowtype;
  v_total            integer;
  v_used             integer;
  v_offset           integer;
  v_remaining        integer;
  v_credits_deducted boolean;
begin
  -- (a) base staff gate — owner/manager/front_desk may reach confirmation.
  if not public.staff_role_is(array['owner', 'manager', 'front_desk']) then
    raise exception 'Order confirmation access required'
      using errcode = 'insufficient_privilege';
  end if;

  -- (b) lock the target order row for the life of the transaction.
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

  -- (d) only a pending order can be confirmed.
  if v_order.status is distinct from 'pending' then
    raise exception 'Order is not pending confirmation (current status: %)', v_order.status
      using errcode = 'check_violation';
  end if;

  -- credits_deducted is carried forward unchanged unless the package branch
  -- performs a deduction (single/corporate keep the M2B3A behaviour: false).
  v_credits_deducted := v_order.credits_deducted;

  -- (e) PACKAGE branch — atomic portion deduction + consumption ledger entry.
  if v_order.order_kind = 'package' then

    -- (e.1) package confirmation requires owner/manager: the ledger writer is
    --       owner/manager-gated, so front_desk cannot complete a package order.
    if not public.staff_role_is(array['owner', 'manager']) then
      raise exception 'Package order confirmation requires an owner or manager'
        using errcode = 'insufficient_privilege';
    end if;

    -- (e.2) a package order must be tied to a customer.
    if v_order.customer_id is null then
      raise exception 'Package order has no linked customer'
        using errcode = 'check_violation';
    end if;

    -- (e.3) idempotency guard — never deduct twice.
    if v_order.credits_deducted is true then
      raise exception 'Package order credits already deducted'
        using errcode = 'check_violation';
    end if;

    -- (e.4) lock the customer balance row and read authoritative portions.
    select coalesce(total_portions, 0),
           coalesce(used_portions, 0),
           coalesce(opening_offset, 0)
      into v_total, v_used, v_offset
      from public.bento_customers
     where id = v_order.customer_id
     for update;

    if not found then
      raise exception 'Linked customer not found for package order'
        using errcode = 'no_data_found';
    end if;

    -- (e.5) remaining = total - used - opening_offset; must cover this order.
    v_remaining := v_total - v_used - v_offset;
    if v_remaining < v_order.quantity then
      raise exception 'Not enough remaining package portions (remaining %, required %)',
        v_remaining, v_order.quantity
        using errcode = 'check_violation';
    end if;

    -- (e.6) authoritative balance update (columns remain source of truth).
    update public.bento_customers
       set used_portions = coalesce(used_portions, 0) + v_order.quantity
     where id = v_order.customer_id;

    -- (e.7) audit trail — ONE consumption row, idempotent via event_key.
    --       Positional call matches the confirmed signature
    --       (integer,text,integer,text,text,bigint,bigint,integer,text,jsonb):
    --       customer_id, entry_type, delta, source, reason, purchase_id,
    --       order_id, period_no, event_key, metadata.
    --       fn_write_meal_ledger_entry is ledger-only (does NOT touch
    --       used_portions) and ON CONFLICT(event_key) returns the existing row.
    perform public.fn_write_meal_ledger_entry(
      v_order.customer_id::integer,               -- customer_id  (integer)
      'consumption',                              -- entry_type
      (-v_order.quantity)::integer,               -- delta (negative = debit)
      'customer_app',                             -- source
      'customer_order_confirmed',                 -- reason
      null::bigint,                               -- purchase_id
      v_order.id,                                 -- order_id
      null::integer,                              -- period_no
      'order_consumption:' || v_order.id,         -- event_key (idempotency)
      jsonb_build_object(
        'order_id',   v_order.id,
        'quantity',   v_order.quantity,
        'order_kind', v_order.order_kind
      )                                           -- metadata (NOT NULL)
    );

    v_credits_deducted := true;
  end if;

  -- (f) confirm: advance to completed + stamp who/when. credits_deducted is set
  --     to true only when the package branch deducted; single/corporate keep the
  --     inbound value (false). M2B2 pricing columns are never written here.
  update public.bento_orders
     set status           = 'completed',
         confirmed_by     = auth.uid(),
         confirmed_at     = now(),
         credits_deducted = v_credits_deducted
   where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$fn$;

comment on function public.confirm_customer_order(bigint) is
  'Wave 3 M2B3B: staff confirmation + package deduction. owner/manager/front_desk '
  'confirm a source=customer_app, status=pending order (locks the row, status '
  'pending->completed, confirmed_by/at stamped). For order_kind=package: requires '
  'owner/manager, locks the customer row, checks remaining = total_portions - '
  'used_portions - opening_offset >= quantity, sets used_portions += quantity, '
  'writes ONE consumption ledger row via fn_write_meal_ledger_entry '
  '(event_key=order_consumption:<id>), and sets credits_deducted=true — all in one '
  'transaction. single/corporate: no deduction, no ledger, credits_deducted stays '
  'false. M2B2 pricing preserved. No cancel/reversal (M2B3C). SECURITY DEFINER.';

-- Reassert execute scope (create or replace preserves grants; explicit for safety).
revoke all on function public.confirm_customer_order(bigint) from public, anon;
grant execute on function public.confirm_customer_order(bigint) to authenticated;

commit;


-- ============================================================================
-- SECTION 3 · POSTCHECK  (3.1–3.4 READ-ONLY)
-- ============================================================================

-- 3.1 function still exists  (expect: not null)
select to_regprocedure('public.confirm_customer_order(bigint)') as rpc_regprocedure;

-- 3.2 security pattern unchanged  (expect: security_definer=true; search_path=public, auth)
select p.proname, p.prosecdef as security_definer, p.proconfig as settings,
       (select rolname from pg_roles where oid = p.proowner) as owner
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public' and p.proname='confirm_customer_order';

-- 3.3 grants unchanged  (expect: auth_exec=true, anon_exec=false)
select
  has_function_privilege('authenticated','public.confirm_customer_order(bigint)','EXECUTE') as auth_exec,
  has_function_privilege('anon','public.confirm_customer_order(bigint)','EXECUTE') as anon_exec;

-- 3.4 inspect body: expect base gate ['owner','manager','front_desk']; package
--     sub-gate ['owner','manager']; FOR UPDATE on bento_orders AND bento_customers;
--     remaining = total_portions-used_portions-opening_offset guard; used_portions
--     += quantity; fn_write_meal_ledger_entry consumption call with delta negative
--     and event_key 'order_consumption:'||id; credits_deducted set true in package
--     branch only; NO writes to order_kind/unit_price/delivery_fee/amount.
select pg_get_functiondef('public.confirm_customer_order(bigint)'::regprocedure) as function_definition;

-- 3.5 OPTIONAL transactional smoke test — MUST ROLLBACK. Run on STAGING as a real
--     authenticated owner/manager session (SQL Editor auth.uid() is NULL -> gate).
--     Requires a seeded PACKAGE customer (active_package_code set, total_portions
--     with remaining balance) and a pending customer_app package order.
--   begin;
--     -- capture before: used_portions, ledger count, order pricing
--     select (public.confirm_customer_order(<pending_package_order_id>)).*;
--     -- expect: status='completed'; credits_deducted=true; confirmed_by/at set;
--     --         order_kind/unit_price/delivery_fee/amount UNCHANGED;
--     --         used_portions +quantity; exactly ONE new consumption ledger row
--     --         with delta = -quantity and event_key 'order_consumption:<id>'.
--   rollback;   -- REQUIRED
--   -- Negative checks (each own begin/rollback):
--   --   * front_desk confirming a package order -> 'requires an owner or manager'
--   --   * remaining < quantity                  -> 'Not enough remaining package portions'
--   --   * re-confirm (already completed)         -> 'not pending confirmation'
--   -- single/corporate order confirm -> completed, credits_deducted stays false,
--   --   used_portions unchanged, no ledger row.


-- ============================================================================
-- SECTION 4 · MANUAL ROLLBACK  (NOT executed by this file)
-- ============================================================================
-- M2B3B only replaces the function body (behaviour add; no schema change).
-- To revert M2B3B -> M2B3A behaviour, re-apply the M2B3A definition (SECTION 2 of
-- 20260702_wave3_m2b3a_confirm_customer_order.sql), which drops the package
-- deduction branch (confirmation stops writing used_portions / ledger /
-- credits_deducted). To remove the RPC entirely:
--
--   drop function if exists public.confirm_customer_order(bigint);
--
-- NOTE: a FAILED apply rolls back automatically (single transaction). Any
-- consumption ledger rows COMMITTED by successful confirmations are append-only
-- and are corrected by compensating reversal rows in M2B3C — never deleted.
-- ============================================================================
