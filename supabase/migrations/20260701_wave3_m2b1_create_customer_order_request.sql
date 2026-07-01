-- ============================================================================
-- Wave 3 · Ordering Backend · M2B1 — RPC skeleton public.create_customer_order_request
-- ----------------------------------------------------------------------------
-- The SMALLEST safe write path for an authenticated customer to submit ONE
-- pending order request. This is the plumbing skeleton only:
--
--   * resolves the caller (auth.uid()) to exactly one linked bento_customers row
--   * inserts a single 'pending' / source='customer_app' bento_orders row
--   * SECURITY DEFINER, pinned search_path, execute granted to authenticated only
--
-- >>> SKELETON ONLY — NOT FINAL BUSINESS VALIDATION. <<<
-- This function deliberately performs NO menu-window check, NO service-area gate,
-- NO ordering-mode enforcement, and NO server-side pricing. Those land in M2B2.
-- It performs NO meal-credit deduction, NO ledger write, NO confirmation, and NO
-- notifications (M3/M4). Pricing/classification columns are left NULL on purpose.
-- The ONLY input validation here is a minimal quantity > 0 guard; every other
-- input check is deferred to M2B2 (base-table CHECK/NOT NULL constraints apply).
--
-- Run sections manually in the Supabase SQL Editor (staging first). Only the
-- APPLY section changes state (it creates a function; it inserts no rows).
-- ============================================================================


-- ============================================================================
-- SECTION 1 · PRECHECK  (READ-ONLY)
-- ============================================================================

-- 1.1 function is ABSENT before APPLY  (expect: null)
select to_regprocedure(
  'public.create_customer_order_request(date, integer, text, bigint, text, text, time)'
) as rpc_regprocedure;

-- 1.2 bento_orders exists  (expect: not null)
select to_regclass('public.bento_orders') as bento_orders_regclass;

-- 1.3 deterministic caller resolution: UNIQUE guarantee on bento_customers.auth_user_id
--     (expect: >= 1 row — a unique/PK constraint or unique index covering auth_user_id)
select con.conname, con.contype, pg_get_constraintdef(con.oid) as def
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace ns on ns.oid = rel.relnamespace
where ns.nspname = 'public' and rel.relname = 'bento_customers'
  and con.contype in ('u','p')
  and pg_get_constraintdef(con.oid) ilike '%auth_user_id%'
union all
select i.relname, 'i'::"char", pg_get_indexdef(idx.indexrelid)
from pg_index idx
join pg_class i on i.oid = idx.indexrelid
join pg_class t on t.oid = idx.indrelid
join pg_namespace ns on ns.oid = t.relnamespace
where ns.nspname = 'public' and t.relname = 'bento_customers'
  and idx.indisunique and pg_get_indexdef(idx.indexrelid) ilike '%auth_user_id%';

-- 1.4 all insert-target columns exist on bento_orders  (expect: 14 rows)
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'bento_orders'
  and column_name in (
    'customer_id','date','quantity','fulfillment_type','delivery_area_id',
    'items','note','delivery_or_pickup_time','status','source',
    'requested_by','requested_at','payment_status','credits_deducted'
  )
order by column_name;

-- 1.5 CHECK constraints admit the skeleton's literal values
--     (expect: status admits 'pending'; source admits 'customer_app';
--      payment_status admits 'unpaid'; fulfillment_type admits 'delivery'/'pickup')
--     NOTE: the source CHECK admitting 'customer_app' was previously verified in
--     Production; re-run only if schema changed.
select con.conname, pg_get_constraintdef(con.oid) as def
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace ns on ns.oid = rel.relnamespace
where ns.nspname = 'public' and rel.relname = 'bento_orders' and con.contype = 'c'
order by con.conname;

-- 1.6 PRODUCTION GATE — prove the INSERT covers every NOT NULL column that has
--     no default. Any row returned means that column would raise
--     not_null_violation on INSERT: STOP, do NOT continue to APPLY.
--     (expect: 0 rows)
select
    column_name
from information_schema.columns
where table_schema='public'
  and table_name='bento_orders'
  and is_nullable='NO'
  and column_default is null
  and is_identity = 'NO'
  and is_generated = 'NEVER'
  and column_name not in (
    'customer_id',
    'date',
    'quantity',
    'fulfillment_type',
    'delivery_area_id',
    'items',
    'note',
    'delivery_or_pickup_time',
    'status',
    'source',
    'requested_by',
    'requested_at',
    'payment_status',
    'credits_deducted'
);


-- ============================================================================
-- SECTION 2 · APPLY  (FUNCTION + GRANTS ONLY — no rows, no base-table/RLS change)
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
  v_uid         uuid   := auth.uid();
  v_customer_id bigint;
  v_order_id    bigint;
begin
  -- (a) reject unauthenticated callers
  if v_uid is null then
    raise exception 'not authenticated'
      using errcode = 'insufficient_privilege';
  end if;

  -- (b) minimal input guard: quantity must be positive.
  --     (Full input/business validation is deferred to M2B2.)
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'order quantity must be greater than zero'
      using errcode = 'check_violation';
  end if;

  -- (c) resolve EXACTLY ONE linked customer for this auth user.
  --     auth_user_id is unique (verified in PRECHECK 1.3), so > 1 cannot occur;
  --     STRICT still enforces the "exactly one" contract defensively.
  begin
    select c.id
      into strict v_customer_id
      from public.bento_customers c
     where c.auth_user_id = v_uid;
  exception
    when no_data_found then
      raise exception 'no linked customer found for this account'
        using errcode = 'no_data_found';
    when too_many_rows then
      raise exception 'multiple customers linked to this account; contact staff'
        using errcode = 'cardinality_violation';
  end;

  -- (d) insert ONE pending order request. Skeleton: server sets identity/status
  --     fields; pricing + classification columns are intentionally left NULL.
  insert into public.bento_orders (
    customer_id,
    "date",
    quantity,
    fulfillment_type,
    delivery_area_id,
    items,
    note,
    delivery_or_pickup_time,
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
    'pending',
    'customer_app',
    v_uid,
    now(),
    'unpaid',
    false
  )
  returning id into v_order_id;
  -- NOTE: unit_price, delivery_fee, amount, order_kind are deliberately NOT set
  -- (left NULL) — pricing/classification is M2B2. amount_paid / payment_note rely
  -- on their base-table defaults (0 / '').

  return v_order_id;
end;
$fn$;

comment on function public.create_customer_order_request(date, integer, text, bigint, text, text, time) is
  'Wave 3 M2B1 (skeleton): single customer write path. Resolves auth.uid() to '
  'exactly one linked bento_customers row and inserts one status=pending, '
  'source=customer_app bento_orders row. No pricing, no area/window/mode checks '
  '(only a minimal quantity>0 guard), no deduction, no ledger, no confirmation, '
  'no notifications. SECURITY DEFINER; execute granted to authenticated only.';

-- Lock down execute: customers (authenticated) only; never public/anon.
revoke all on function public.create_customer_order_request(date, integer, text, bigint, text, text, time) from public, anon;
grant execute on function public.create_customer_order_request(date, integer, text, bigint, text, text, time) to authenticated;

commit;

-- Manual rollback (NOT executed here) — see SECTION 4.


-- ============================================================================
-- SECTION 3 · POSTCHECK  (READ-ONLY)
-- ============================================================================

-- 3.1 function now exists  (expect: not null)
select to_regprocedure(
  'public.create_customer_order_request(date, integer, text, bigint, text, text, time)'
) as rpc_regprocedure;

-- 3.2 security pattern: SECURITY DEFINER + pinned search_path + owner
--     (expect: security_definer = true; settings contains search_path=public, auth)
select p.proname,
       p.prosecdef as security_definer,
       pg_get_function_identity_arguments(p.oid) as args,
       (select rolname from pg_roles where oid = p.proowner) as owner,
       p.proconfig as settings,
       p.proacl    as acl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'create_customer_order_request';

-- 3.3 grants: authenticated has EXECUTE; anon / PUBLIC do NOT have EXECUTE;
--     postgres / service_role may appear and are acceptable.
--     (expect: auth_exec = true; anon_exec = false. Because every role inherits
--      PUBLIC, anon_exec = false also proves PUBLIC carries no EXECUTE grant.
--      service_role_exec may be true or false — either is acceptable.)
select
  has_function_privilege('authenticated',
    'public.create_customer_order_request(date, integer, text, bigint, text, text, time)','EXECUTE') as auth_exec,
  has_function_privilege('anon',
    'public.create_customer_order_request(date, integer, text, bigint, text, text, time)','EXECUTE') as anon_exec,
  has_function_privilege('service_role',
    'public.create_customer_order_request(date, integer, text, bigint, text, text, time)','EXECUTE') as service_role_exec;

-- 3.4 return type is bigint  (expect: bigint)
select pg_catalog.format_type(p.prorettype, null) as return_type
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'create_customer_order_request';


-- ============================================================================
-- SECTION 4 · MANUAL ROLLBACK  (NOT executed by this file)
-- ============================================================================
-- Drops the function and (implicitly) its execute grant. Additive change: no
-- rows, columns, policies, or constraints were touched, so nothing else to undo.
--
--   drop function if exists public.create_customer_order_request(
--     date, integer, text, bigint, text, text, time
--   );


-- ============================================================================
-- SECTION 5 · OPTIONAL TRANSACTIONAL SMOKE TEST
--     (documentation only — NOT part of the read-only POSTCHECK above)
-- ============================================================================
-- This section WRITES a real pending order, so each positive case is wrapped in
-- a transaction and MUST be rolled back. It is NOT executed by this file — run
-- it manually on STAGING as a real authenticated customer session (a JWT whose
-- auth.uid() maps to a linked bento_customers.auth_user_id). In the Supabase SQL
-- Editor auth.uid() is NULL, which instead exercises the "not authenticated"
-- guard (case S3).
--
--   * writes inside a transaction
--   * MUST ROLLBACK (no row is persisted)
--   * NOT part of the read-only POSTCHECK
--
-- (S1) Positive — logged-in customer; capture the returned id, inspect the row,
--      then discard it via ROLLBACK:
--   begin;
--     with created as (
--       select public.create_customer_order_request(
--                current_date + 1,   -- p_date
--                3,                   -- p_quantity
--                'pickup',            -- p_fulfillment_type
--                null,                -- p_delivery_area_id
--                null,                -- p_items
--                'skeleton smoke',    -- p_note
--                null                 -- p_delivery_or_pickup_time
--              ) as new_id
--     )
--     select o.customer_id, o."date", o.quantity, o.fulfillment_type, o.items,
--            o.note, o.delivery_or_pickup_time, o.status, o.source,
--            o.requested_by, o.requested_at, o.payment_status, o.credits_deducted,
--            o.order_kind, o.unit_price, o.delivery_fee, o.amount,  -- expect NULL
--            o.confirmed_by, o.confirmed_at                          -- expect NULL
--     from public.bento_orders o
--     join created c on o.id = c.new_id;
--     -- expect: status='pending', source='customer_app', credits_deducted=false;
--     --         pricing/confirm columns NULL; bento_customers.used_portions unchanged.
--   rollback;   -- REQUIRED: discard the smoke-test row
--
-- (S2) Positive — delivery variant (still no pricing):
--   begin;
--     select public.create_customer_order_request(
--       current_date + 2, 5, 'delivery', <active_area_id>, null, 'deliv smoke', null
--     );
--     -- expect: returns id; delivery_area_id persisted; unit_price/delivery_fee/
--     --         amount/order_kind still NULL.
--   rollback;   -- REQUIRED
--
-- Negative cases (no row is written; safe to run without a transaction):
-- (S3) unauthenticated (SQL Editor / service context):
--        select public.create_customer_order_request(current_date, 1, 'pickup');
--        -- expect: ERROR insufficient_privilege 'not authenticated'
-- (S4) authenticated user with NO linked customer row:
--        -- expect: ERROR no_data_found 'no linked customer found for this account'
-- (S5) non-positive quantity (authenticated + linked):
--        select public.create_customer_order_request(current_date, 0, 'pickup');
--        -- expect: ERROR check_violation 'order quantity must be greater than zero'
-- ============================================================================
