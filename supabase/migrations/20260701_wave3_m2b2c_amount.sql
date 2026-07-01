-- ============================================================================
-- Wave 3 · Ordering Backend · M2B2C — add amount to
-- public.create_customer_order_request
-- ----------------------------------------------------------------------------
-- Extends M2B2B: the RPC now computes the server-authoritative order total and
-- persists it on the pending order:
--
--     amount = unit_price * quantity + delivery_fee
--
-- All operands are already resolved in-memory earlier in the function
-- (v_unit_price from M2B2A, v_delivery_fee from M2B2B, p_quantity from the args),
-- so M2B2C adds NO new table read — only the final multiply/add and the insert.
--
-- SCOPE (M2B2C) — amount ONLY. order_kind / unit_price / delivery_fee logic is
-- UNCHANGED. No deduction, no ledger, no credits, no menu/mode validation,
-- no M2B3+ work.
--
-- Idempotent (create or replace). Reversible (restore the M2B2B body — SECTION 4).
-- Signature unchanged; create or replace preserves grants (re-asserted below).
-- Run sections manually in the Supabase SQL Editor (staging first). Only APPLY
-- changes state (it replaces a function; it inserts no rows).
-- ============================================================================


-- ============================================================================
-- SECTION 1 · PRECHECK  (READ-ONLY)
-- ============================================================================

-- 1.1 the function to replace already exists  (expect: not null)
select to_regprocedure(
  'public.create_customer_order_request(date, integer, text, bigint, text, text, time)'
) as rpc_regprocedure;

-- 1.2 target column bento_orders.amount  (expect: numeric, nullable, not generated)
select column_name, data_type, is_nullable, column_default, is_generated
from information_schema.columns
where table_schema='public' and table_name='bento_orders' and column_name='amount';

-- 1.3 formula input columns present  (expect: unit_price, quantity, delivery_fee)
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema='public' and table_name='bento_orders'
  and column_name in ('unit_price','quantity','delivery_fee')
order by column_name;

-- 1.4 no CHECK constraint on amount blocks a computed total  (expect: 0 rows,
--     or only constraints the non-negative computed amount satisfies)
select conname, pg_get_constraintdef(oid) as def
from pg_constraint
where conrelid='public.bento_orders'::regclass and contype='c'
  and pg_get_constraintdef(oid) ilike '%amount%';

-- 1.5 PRODUCTION GATE — no NOT NULL, default-less, non-generated column is left
--     unset by the INSERT (coverage set now also includes amount).  (expect: 0 rows)
select column_name
from information_schema.columns
where table_schema='public' and table_name='bento_orders'
  and is_nullable='NO' and column_default is null
  and is_identity='NO' and is_generated='NEVER'
  and column_name not in (
    'customer_id','date','quantity','fulfillment_type','delivery_area_id',
    'items','note','delivery_or_pickup_time','order_kind','unit_price','delivery_fee','amount',
    'status','source','requested_by','requested_at','payment_status','credits_deducted'
  );

-- 1.6 no trigger populates pricing on bento_orders  (expect: only audit AFTER trigger)
select t.tgname, pg_get_triggerdef(t.oid) as def
from pg_trigger t
join pg_class c on c.oid=t.tgrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='bento_orders' and not t.tgisinternal
order by t.tgname;


-- ============================================================================
-- SECTION 2 · APPLY  (REPLACE FUNCTION + reassert GRANTS — no rows, no schema change)
-- ============================================================================

begin;

create or replace function public.create_customer_order_request(
  p_date                    date,
  p_quantity                integer,
  p_fulfillment_type        text,
  p_delivery_area_id        bigint  default null,
  p_items                   text    default null,
  p_note                    text    default null,
  p_delivery_or_pickup_time time    default null
)
returns bigint
language plpgsql
security definer
set search_path = public, auth
as $fn$
declare
  free_delivery_min_meals constant integer := 5;   -- >=5 meals => free (locked)
  v_uid              uuid   := auth.uid();
  v_customer_id      bigint;
  v_account_type     text;
  v_active_pkg       text;
  v_custom_price     numeric;
  v_custom_free_del  boolean;
  v_order_kind       text;
  v_unit_price       numeric;
  v_area_fee         numeric;
  v_delivery_fee     numeric;
  v_amount           numeric;
  v_order_id         bigint;
begin
  -- (a) reject unauthenticated callers
  if v_uid is null then
    raise exception 'not authenticated'
      using errcode = 'insufficient_privilege';
  end if;

  -- (b) minimal input guard: quantity must be positive.
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'order quantity must be greater than zero'
      using errcode = 'check_violation';
  end if;

  -- (c) resolve EXACTLY ONE linked customer + pricing inputs for this auth user.
  begin
    select id, account_type, active_package_code, custom_price_per_meal, custom_free_delivery
      into strict v_customer_id, v_account_type, v_active_pkg, v_custom_price, v_custom_free_del
      from public.bento_customers
     where auth_user_id = v_uid;
  exception
    when no_data_found then
      raise exception 'no linked customer found for this account'
        using errcode = 'no_data_found';
    when too_many_rows then
      raise exception 'multiple customers linked to this account; contact staff'
        using errcode = 'cardinality_violation';
  end;

  -- (d) order_kind — server-side classification from the customer's account state.
  if v_account_type = 'corporate' then
    v_order_kind := 'corporate';
  elsif v_active_pkg is not null then
    v_order_kind := 'package';
  else
    v_order_kind := 'single';
  end if;

  -- (e) unit_price — server-authoritative (client price is never trusted).
  if v_order_kind = 'corporate' then
    v_unit_price := v_custom_price;
  elsif v_order_kind = 'package' then
    select price_per_meal
      into v_unit_price
      from public.bento_packages
     where code = v_active_pkg and is_active is true;
  else
    v_unit_price := 18;
  end if;

  -- (e.1) unit_price must be resolvable, never NULL.
  if v_unit_price is null then
    raise exception 'Unable to determine unit price for this customer.'
      using errcode = 'check_violation';
  end if;

  -- (g) delivery_fee — server-authoritative + service-area gate.
  if p_fulfillment_type = 'pickup' then
    -- pickup: no delivery, no area required.
    v_delivery_fee := 0;
  else
    -- delivery: a supported (ACTIVE) service area is required.
    if p_delivery_area_id is null then
      raise exception 'A delivery area is required for delivery orders.'
        using errcode = 'check_violation';
    end if;

    select delivery_fee
      into v_area_fee
      from public.bento_delivery_areas
     where id = p_delivery_area_id and active is true;

    if not found then
      -- missing or inactive area => outside service area (D9).
      raise exception 'Sorry, this address is currently outside our delivery area.'
        using errcode = 'check_violation';
    end if;

    if v_order_kind = 'package' then
      v_delivery_fee := 0;                                       -- packages: free
    elsif v_order_kind = 'single' then
      v_delivery_fee := case when p_quantity >= free_delivery_min_meals
                             then 0 else v_area_fee end;         -- >=5 meals: free
    else  -- corporate
      v_delivery_fee := case when coalesce(v_custom_free_del, false)
                             then 0 else v_area_fee end;
    end if;
  end if;

  -- (h) amount — server-authoritative order total.
  --     All operands are non-null here: v_unit_price guarded in (e.1),
  --     v_delivery_fee always set in (g), p_quantity > 0 from (b).
  v_amount := v_unit_price * p_quantity + v_delivery_fee;

  -- (f) insert ONE pending order. M2B2C now also sets amount; pricing is complete.
  insert into public.bento_orders (
    customer_id,
    "date",
    quantity,
    fulfillment_type,
    delivery_area_id,
    items,
    note,
    delivery_or_pickup_time,
    order_kind,
    unit_price,
    delivery_fee,
    amount,
    status,
    source,
    requested_by,
    requested_at,
    payment_status,
    credits_deducted
  ) values (
    v_customer_id,
    p_date,
    p_quantity,
    p_fulfillment_type,
    p_delivery_area_id,
    p_items,
    p_note,
    p_delivery_or_pickup_time,
    v_order_kind,
    v_unit_price,
    v_delivery_fee,
    v_amount,
    'pending',
    'customer_app',
    v_uid,
    now(),
    'unpaid',
    false
  )
  returning id into v_order_id;
  -- NOTE: no deduction / ledger here (credits_deducted stays false; that is M3).

  return v_order_id;
end;
$fn$;

comment on function public.create_customer_order_request(date, integer, text, bigint, text, text, time) is
  'Wave 3 M2B2C: single customer write path. Resolves auth.uid() -> exactly one '
  'bento_customers row; derives order_kind + unit_price (M2B2A); delivery_fee + '
  'service-area gate (M2B2B); computes amount = unit_price*quantity+delivery_fee; '
  'inserts one status=pending, source=customer_app order with order_kind, '
  'unit_price, delivery_fee, amount set. No deduction, no ledger, no menu/mode '
  'validation. SECURITY DEFINER; authenticated only.';

-- Reassert execute scope (create or replace preserves grants; explicit for safety).
revoke all on function public.create_customer_order_request(date, integer, text, bigint, text, text, time) from public, anon;
grant execute on function public.create_customer_order_request(date, integer, text, bigint, text, text, time) to authenticated;

commit;


-- ============================================================================
-- SECTION 3 · POSTCHECK  (3.1–3.4 READ-ONLY)
-- ============================================================================

-- 3.1 function still exists  (expect: not null)
select to_regprocedure(
  'public.create_customer_order_request(date, integer, text, bigint, text, text, time)'
) as rpc_regprocedure;

-- 3.2 security pattern unchanged  (expect: security_definer=true; search_path=public, auth)
select p.proname, p.prosecdef as security_definer, p.proconfig as settings,
       (select rolname from pg_roles where oid = p.proowner) as owner
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public' and p.proname='create_customer_order_request';

-- 3.3 grants unchanged  (expect: auth_exec=true, anon_exec=false; service_role acceptable)
select
  has_function_privilege('authenticated','public.create_customer_order_request(date, integer, text, bigint, text, text, time)','EXECUTE') as auth_exec,
  has_function_privilege('anon','public.create_customer_order_request(date, integer, text, bigint, text, text, time)','EXECUTE') as anon_exec,
  has_function_privilege('service_role','public.create_customer_order_request(date, integer, text, bigint, text, text, time)','EXECUTE') as service_role_exec;

-- 3.4 definition sets amount = unit_price*quantity+delivery_fee, and amount is now
--     in the INSERT column list. Inspect the body: expect order_kind/unit_price/
--     delivery_fee/amount in the INSERT list; the 'v_amount := v_unit_price *
--     p_quantity + v_delivery_fee' expression present; NO ledger/deduction.
select pg_get_functiondef(
  'public.create_customer_order_request(date, integer, text, bigint, text, text, time)'::regprocedure
) as function_definition;

-- 3.5 OPTIONAL transactional smoke test — writes inside a transaction, MUST ROLLBACK.
--     NOT part of the read-only POSTCHECK. Run on STAGING as a real authenticated,
--     linked customer session (SQL Editor auth.uid() is NULL -> hits the auth guard).
--   -- single, pickup, qty 3 -> unit 18, fee 0, amount = 18*3 + 0 = 54
--   begin;
--     select public.create_customer_order_request(current_date+1, 3, 'pickup', null, null, 'amt smoke', null);
--   rollback;
--   -- single, delivery, qty 2, ACTIVE area fee=F -> amount = 18*2 + F
--   begin;
--     select public.create_customer_order_request(current_date+1, 2, 'delivery', <active_area_id>, null, 'amt deliv', null);
--   rollback;
--   -- single, delivery, qty 5 (>=5 free) -> amount = 18*5 + 0 = 90
--   -- Verify inserted amount == unit_price*quantity + delivery_fee in each case.


-- ============================================================================
-- SECTION 4 · MANUAL ROLLBACK  (NOT executed by this file)
-- ============================================================================
-- M2B2C only replaces the function body (additive behavior; no schema change).
-- To revert M2B2C -> M2B2B behavior, re-apply the M2B2B definition (the body from
-- 20260701_wave3_m2b2b_delivery_fee.sql SECTION 2), which stops computing amount
-- (amount returns to NULL). To remove the RPC entirely:
--
--   drop function if exists public.create_customer_order_request(
--     date, integer, text, bigint, text, text, time
--   );
-- ============================================================================
