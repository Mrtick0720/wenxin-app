-- ============================================================================
-- Wave 3 · Ordering Backend · M2B2B — add delivery_fee + service-area gate to
-- public.create_customer_order_request
-- ----------------------------------------------------------------------------
-- Extends M2B2A: the RPC now computes the server-authoritative delivery_fee and
-- enforces the service-area gate for delivery orders, and persists delivery_fee
-- on the pending order.
--
-- SCOPE (M2B2B) — delivery_fee + service-area gate ONLY.
-- Delivery-fee rules (server-authoritative; client fee never trusted):
--   * pickup                       -> delivery_fee = 0, area NOT required
--   * delivery + NULL area         -> REJECT ('a delivery area is required')
--   * delivery + missing/inactive  -> REJECT ('outside our delivery area')  [D9]
--   * delivery + active area:
--       package   -> 0                          (packages include free delivery)
--       single    -> quantity >= 5 ? 0 : area.delivery_fee   (>=5 meals free)
--       corporate -> coalesce(custom_free_delivery,false) ? 0 : area.delivery_fee
--
-- Deliberately still NOT done here:
--   * amount                  -> depends on delivery_fee      (M2B2C) — stays NULL
--   * menu-window validation, ordering_mode validation        (later)
--   * deduction, ledger, notifications                        (M3 / M4)
--
-- Idempotent (create or replace). Reversible (restore the M2B2A body — SECTION 4).
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

-- 1.2 delivery-fee SOURCE table exists  (expect: not null)
select to_regclass('public.bento_delivery_areas') as bento_delivery_areas;

-- 1.3 bento_delivery_areas required columns  (expect: id, delivery_fee, active present)
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema='public' and table_name='bento_delivery_areas'
  and column_name in ('id','delivery_fee','active')
order by column_name;

-- 1.4 fee-gating INPUT columns  (expect: 2 rows)
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema='public'
  and ((table_name='bento_customers' and column_name='custom_free_delivery')
       or (table_name='bento_packages' and column_name='free_delivery'))
order by table_name;

-- 1.5 target + area-link columns on bento_orders  (expect: 3 rows, all nullable)
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema='public' and table_name='bento_orders'
  and column_name in ('delivery_fee','delivery_area_id','fulfillment_type')
order by column_name;

-- 1.6 FK bento_orders.delivery_area_id -> bento_delivery_areas(id)  (expect: 1 row)
select conname, pg_get_constraintdef(oid) as def
from pg_constraint
where conrelid='public.bento_orders'::regclass and contype='f'
  and pg_get_constraintdef(oid) ilike '%delivery_area%';

-- 1.7 fulfillment_type CHECK admits delivery/pickup  (expect: 1 row)
select conname, pg_get_constraintdef(oid) as def
from pg_constraint
where conrelid='public.bento_orders'::regclass and contype='c'
  and pg_get_constraintdef(oid) ilike '%fulfillment_type%';

-- 1.8 PRODUCTION GATE — no NOT NULL, default-less, non-generated column is left
--     unset by the INSERT (coverage set now also includes delivery_fee).
--     (expect: 0 rows)
select column_name
from information_schema.columns
where table_schema='public' and table_name='bento_orders'
  and is_nullable='NO' and column_default is null
  and is_identity='NO' and is_generated='NEVER'
  and column_name not in (
    'customer_id','date','quantity','fulfillment_type','delivery_area_id',
    'items','note','delivery_or_pickup_time','order_kind','unit_price','delivery_fee',
    'status','source','requested_by','requested_at','payment_status','credits_deducted'
  );

-- 1.9 no trigger populates pricing on bento_orders  (expect: only audit AFTER trigger)
select t.tgname, pg_get_triggerdef(t.oid) as def
from pg_trigger t
join pg_class c on c.oid=t.tgrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='bento_orders' and not t.tgisinternal
order by t.tgname;

-- 1.10 delivery-area seed sanity  (expect: active rows have a fee; inactive have none)
select
  count(*) as total,
  count(*) filter (where active) as active_rows,
  count(*) filter (where not active) as inactive_rows,
  count(*) filter (where active and delivery_fee is null) as active_missing_fee,
  count(*) filter (where not active and delivery_fee is not null) as inactive_with_fee
from public.bento_delivery_areas;


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

  -- (f) insert ONE pending order. M2B2B now also sets delivery_fee;
  --     amount is STILL left NULL (M2B2C).
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
    'pending',
    'customer_app',
    v_uid,
    now(),
    'unpaid',
    false
  )
  returning id into v_order_id;
  -- NOTE: amount is deliberately NOT set (left NULL) — amount is M2B2C.
  -- No deduction / ledger here.

  return v_order_id;
end;
$fn$;

comment on function public.create_customer_order_request(date, integer, text, bigint, text, text, time) is
  'Wave 3 M2B2B: single customer write path. Resolves auth.uid() -> exactly one '
  'bento_customers row; derives order_kind + server-authoritative unit_price '
  '(M2B2A); computes delivery_fee with the service-area gate (pickup=0; delivery '
  'requires an ACTIVE area, else reject; package=0; single free at >=5 meals else '
  'area fee; corporate free if coalesce(custom_free_delivery,false) else area fee); '
  'inserts one status=pending, source=customer_app order with order_kind, '
  'unit_price, delivery_fee set. amount remains NULL (M2B2C). No menu/mode '
  'validation, no deduction, no ledger. SECURITY DEFINER; authenticated only.';

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

-- 3.4 definition sets delivery_fee (with the service-area gate) but NOT amount.
--     Inspect the body: expect order_kind/unit_price/delivery_fee in the INSERT
--     column list; the 'outside our delivery area' + 'a delivery area is required'
--     rejects present; a read of bento_delivery_areas; coalesce(custom_free...);
--     NO 'amount' INSERT target; NO ledger/deduction.
select pg_get_functiondef(
  'public.create_customer_order_request(date, integer, text, bigint, text, text, time)'::regprocedure
) as function_definition;

-- 3.5 OPTIONAL transactional smoke test — writes inside a transaction, MUST ROLLBACK.
--     NOT part of the read-only POSTCHECK. Run on STAGING as a real authenticated,
--     linked customer session (SQL Editor auth.uid() is NULL -> hits the auth guard).
--   -- pickup: expect delivery_fee=0
--   begin;
--     select public.create_customer_order_request(current_date+1, 3, 'pickup', null, null, 'pickup smoke', null);
--   rollback;
--   -- delivery, single, <5 meals, ACTIVE area <id>: expect delivery_fee = area fee
--   begin;
--     select public.create_customer_order_request(current_date+1, 2, 'delivery', <active_area_id>, null, 'deliv smoke', null);
--   rollback;
--   -- delivery, single, >=5 meals, ACTIVE area: expect delivery_fee = 0
--   begin;
--     select public.create_customer_order_request(current_date+1, 5, 'delivery', <active_area_id>, null, 'free deliv smoke', null);
--   rollback;
--   -- delivery, INACTIVE/missing area: expect ERROR 'Sorry, this address is currently outside our delivery area.'
--   -- delivery, NULL area: expect ERROR 'A delivery area is required for delivery orders.'
--   -- In every case amount stays NULL (M2B2C).


-- ============================================================================
-- SECTION 4 · MANUAL ROLLBACK  (NOT executed by this file)
-- ============================================================================
-- M2B2B only replaces the function body (additive behavior; no schema change).
-- To revert M2B2B -> M2B2A behavior, re-apply the M2B2A definition (the body from
-- 20260701_wave3_m2b2a_order_kind_unit_price.sql SECTION 2), which stops computing
-- delivery_fee / the service-area gate (delivery_fee returns to NULL). To remove
-- the RPC entirely:
--
--   drop function if exists public.create_customer_order_request(
--     date, integer, text, bigint, text, text, time
--   );
-- ============================================================================
