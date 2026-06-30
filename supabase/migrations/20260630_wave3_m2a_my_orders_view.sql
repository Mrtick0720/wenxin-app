-- ============================================================================
-- Wave 3 · Ordering Backend · M2A — customer self-read view public.my_orders
-- ----------------------------------------------------------------------------
-- Customer-safe read of a caller's OWN submitted orders, isolated by auth.uid()
-- via bento_customers.auth_user_id -> bento_orders.customer_id.
--
-- Scope (M2A): the my_orders view + grants ONLY.
--   NO RPC, NO RLS policy change, NO order creation, NO ledger/deduction,
--   NO status mutation, NO new columns. (Note: bento_orders has no created_at
--   column in production, so it is intentionally NOT exposed here.)
--
-- Run sections manually in the Supabase SQL Editor (staging first). The APPLY
-- section is the only one that changes state. Not auto-applied by this file.
-- ============================================================================


-- ============================================================================
-- SECTION 1 · PRECHECK  (READ-ONLY)
-- ============================================================================

-- 1.1 bento_orders exists  (expect: regclass not null)
select to_regclass('public.bento_orders') as bento_orders_regclass;

-- 1.2 bento_customers.auth_user_id exists (the auth.uid() link)  (expect: 1 row, uuid)
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'bento_customers'
  and column_name  = 'auth_user_id';

-- 1.3 bento_orders.customer_id exists (join key)  (expect: 1 row, bigint)
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'bento_orders'
  and column_name  = 'customer_id';

-- 1.4 all 12 view-source columns present on bento_orders  (expect: 12 rows)
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'bento_orders'
  and column_name in (
    'id','date','quantity','status','fulfillment_type','delivery_or_pickup_time',
    'items','note','unit_price','delivery_fee','amount','payment_status'
  )
order by column_name;

-- 1.5 my_orders view is ABSENT before APPLY  (expect: 0 rows)
select table_name
from information_schema.views
where table_schema = 'public'
  and table_name   = 'my_orders';


-- ============================================================================
-- SECTION 2 · APPLY  (VIEW + GRANTS ONLY — no base-table or RLS change)
-- ============================================================================

begin;

-- 2.1 Customer-safe read view, isolated to the caller's own customer row(s).
--     Exposes ONLY the 12 approved columns; never customer_id, requested_by/
--     confirmed_by, credits_deducted, source/order_kind, or any kitchen
--     production / internal audit / raw payment-internal fields.
create or replace view public.my_orders
with (security_barrier = true) as
select
  o.id,
  o.date,
  o.quantity,
  o.status,
  o.fulfillment_type,
  o.delivery_or_pickup_time,
  o.items,
  o.note,
  o.unit_price,
  o.delivery_fee,
  o.amount,
  o.payment_status
from public.bento_orders o
join public.bento_customers c
  on c.id = o.customer_id
where c.auth_user_id = auth.uid();

-- 2.2 Lock down grants: customers (authenticated) read; public/anon never.
revoke all on public.my_orders from public, anon;
grant select on public.my_orders to authenticated;

commit;

-- Manual rollback (NOT executed here):
--   drop view if exists public.my_orders;


-- ============================================================================
-- SECTION 3 · POSTCHECK  (READ-ONLY)
-- ============================================================================

-- 3.1 view exists  (expect: 1 row)
select table_name
from information_schema.views
where table_schema = 'public'
  and table_name   = 'my_orders';

-- 3.2 exact exposed column set  (expect: 12 rows, in order; no created_at)
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'my_orders'
order by ordinal_position;

-- 3.3 FORBIDDEN columns are NOT exposed by the view  (expect: 0 rows)
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'my_orders'
  and column_name in (
    'customer_id','requested_by','requested_at','confirmed_by','confirmed_at',
    'credits_deducted','source','order_kind','created_at',
    'customer_name','phone','address','area',
    'bento_items','compartment_a','compartment_b','compartment_c',
    'ready_by','pack_time','menu_type','time_slot',
    'paid','value','payment_method','amount_paid','payment_note'
  );

-- 3.4 grants correct: authenticated = SELECT; no public/anon grants
--     (expect: one row grantee=authenticated, privilege_type=SELECT)
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name   = 'my_orders'
order by grantee, privilege_type;

-- 3.5 isolation filter present (auth.uid() -> auth_user_id) in the definition
select pg_get_viewdef('public.my_orders'::regclass, true) as my_orders_definition;

-- 3.6 base table RLS unchanged — bento_orders still staff-only, no customer policy added
select policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename  = 'bento_orders'
order by policyname;

-- 3.7 NO RPC created by M2A  (expect: 0 rows)
select proname
from pg_proc
where proname = 'create_customer_order_request';
