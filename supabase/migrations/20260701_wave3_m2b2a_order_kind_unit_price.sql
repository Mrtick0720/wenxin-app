-- ============================================================================
-- Wave 3 · Ordering Backend · M2B2A — add order_kind + unit_price to
-- public.create_customer_order_request  (server-side classification + unit price)
-- ----------------------------------------------------------------------------
-- Extends the M2B1 skeleton: the RPC now derives order_kind and the
-- server-authoritative unit_price from the caller's bento_customers row + the
-- bento_packages catalog, and persists BOTH on the pending order.
--
-- SCOPE (M2B2A) — order_kind + unit_price ONLY.
-- Deliberately still NOT done here (delivery_fee and amount remain NULL):
--   * delivery_fee            -> depends on bento_delivery_areas   (M2B2B)
--   * amount                  -> depends on delivery_fee           (M2B2C)
--   * delivery-area / service-area validation                     (M2B2B)
--   * menu-window validation, ordering_mode validation            (later)
--   * deduction, ledger, notifications                            (M3 / M4)
--
-- Idempotent (create or replace). Reversible (restore the M2B1 body — SECTION 4).
-- Signature unchanged, so create or replace preserves existing grants; they are
-- re-asserted below for an explicit security posture.
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

-- 1.2 pricing INPUT columns exist  (expect: 6 rows)
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema='public'
  and (
    (table_name='bento_customers' and column_name in ('account_type','active_package_code','custom_price_per_meal'))
    or (table_name='bento_packages' and column_name in ('code','price_per_meal','is_active'))
  )
order by table_name, column_name;

-- 1.3 pricing TARGET columns exist and are nullable  (expect: 2 rows, both is_nullable=YES)
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema='public' and table_name='bento_orders'
  and column_name in ('order_kind','unit_price')
order by column_name;

-- 1.4 PRODUCTION GATE — no NOT NULL, default-less, non-generated column is left
--     unset by the INSERT (coverage set now also includes order_kind, unit_price).
--     (expect: 0 rows)
select column_name
from information_schema.columns
where table_schema='public' and table_name='bento_orders'
  and is_nullable='NO' and column_default is null
  and is_identity='NO' and is_generated='NEVER'
  and column_name not in (
    'customer_id','date','quantity','fulfillment_type','delivery_area_id',
    'items','note','delivery_or_pickup_time','order_kind','unit_price',
    'status','source','requested_by','requested_at','payment_status','credits_deducted'
  );

-- 1.5 no trigger populates pricing on bento_orders  (expect: only audit-type AFTER
--     triggers e.g. write_operational_audit; none that fill order_kind/unit_price)
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
  v_uid          uuid   := auth.uid();
  v_customer_id  bigint;
  v_account_type text;
  v_active_pkg   text;
  v_custom_price numeric;
  v_order_kind   text;
  v_unit_price   numeric;
  v_order_id     bigint;
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
    select id, account_type, active_package_code, custom_price_per_meal
      into strict v_customer_id, v_account_type, v_active_pkg, v_custom_price
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
  --     corporate -> customer's custom price; package -> active catalog price;
  --     single    -> RM 18/meal (locked).
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

  -- (e.1) M2B2A owns unit_price: it must be resolvable, never NULL. If a corporate
  --       customer has no custom_price_per_meal, or a package customer's
  --       active_package_code has no ACTIVE catalog row, reject the request rather
  --       than persist a NULL unit_price.
  if v_unit_price is null then
    raise exception 'Unable to determine unit price for this customer.'
      using errcode = 'check_violation';
  end if;

  -- (f) insert ONE pending order. M2B2A now also sets order_kind + unit_price;
  --     delivery_fee and amount are STILL left NULL (M2B2B / M2B2C).
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
    'pending',
    'customer_app',
    v_uid,
    now(),
    'unpaid',
    false
  )
  returning id into v_order_id;
  -- NOTE: delivery_fee and amount are deliberately NOT set (left NULL) —
  -- delivery_fee is M2B2B, amount is M2B2C. No deduction / ledger here.

  return v_order_id;
end;
$fn$;

comment on function public.create_customer_order_request(date, integer, text, bigint, text, text, time) is
  'Wave 3 M2B2A: single customer write path. Resolves auth.uid() -> exactly one '
  'bento_customers row; derives order_kind (corporate/package/single) and the '
  'server-authoritative unit_price (corporate=custom_price_per_meal, '
  'package=active bento_packages.price_per_meal, single=18); rejects if unit_price '
  'cannot be determined; inserts one status=pending, source=customer_app order '
  'with order_kind + unit_price set. delivery_fee and amount remain NULL '
  '(M2B2B/M2B2C). No area/menu/mode validation, no deduction, no ledger. '
  'SECURITY DEFINER; authenticated only.';

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

-- 3.4 definition sets order_kind + unit_price (with the not-null guard) but NOT
--     delivery_fee / amount. Inspect the body: expect order_kind and unit_price in
--     the INSERT column list, the 'Unable to determine unit price' guard present,
--     and NO 'delivery_fee'/'amount' INSERT targets and NO ledger/deduction.
select pg_get_functiondef(
  'public.create_customer_order_request(date, integer, text, bigint, text, text, time)'::regprocedure
) as function_definition;

-- 3.5 OPTIONAL transactional smoke test — writes inside a transaction, MUST ROLLBACK.
--     NOT part of the read-only POSTCHECK. Run on STAGING as a real authenticated,
--     linked customer session (SQL Editor auth.uid() is NULL -> hits the auth guard).
--   begin;
--     with created as (
--       select public.create_customer_order_request(
--                current_date + 1, 3, 'pickup', null, null, 'm2b2a smoke', null
--              ) as new_id
--     )
--     select o.order_kind, o.unit_price,          -- expect populated + NON-NULL
--            o.delivery_fee, o.amount,             -- expect NULL (deferred)
--            o.status, o.source, o.credits_deducted
--     from public.bento_orders o join created c on o.id = c.new_id;
--     -- package customer -> order_kind='package', unit_price=catalog price;
--     -- single           -> order_kind='single',  unit_price=18;
--     -- corporate        -> order_kind='corporate', unit_price=custom_price_per_meal;
--     -- delivery_fee & amount NULL; status='pending'; source='customer_app'.
--     -- A customer with no resolvable unit_price -> ERROR check_violation
--     --   'Unable to determine unit price for this customer.' (no row inserted).
--   rollback;   -- REQUIRED: discard the smoke-test row


-- ============================================================================
-- SECTION 4 · MANUAL ROLLBACK  (NOT executed by this file)
-- ============================================================================
-- M2B2A only replaces the function body (additive behavior; no schema change).
-- To revert M2B2A -> M2B1 behavior, re-apply the M2B1 definition (the skeleton
-- body from 20260701_wave3_m2b1_create_customer_order_request.sql SECTION 2),
-- which stops setting order_kind/unit_price. To remove the RPC entirely:
--
--   drop function if exists public.create_customer_order_request(
--     date, integer, text, bigint, text, text, time
--   );
-- ============================================================================
