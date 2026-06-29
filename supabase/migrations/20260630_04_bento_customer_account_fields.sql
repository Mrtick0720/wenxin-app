-- Wave 1 / Migration #4 — Customer account-model fields on bento_customers.
--
-- Source of truth: xin-bento-mobile/docs/MIGRATION_PLAN_V1.md §5.8 and
-- BACKEND_PLAN_V1.md §2. Additive, idempotent, reversible.
--
-- Adds the native V1 account model on TOP of the existing legacy fields
-- (subscription_type / package_mode / subscription_mode are preserved, untouched).
-- Existing rows take safe defaults (account_type='standard', ordering_mode=
-- 'selectable'); mapping legacy corporate/school/postpaid customers to
-- account_type='corporate' is a LATER, non-destructive data step (NOT in Wave 1).
--
-- Per §0/D11 there is NO automatic package expiry in V1 (the pre-existing
-- credit_expiry_date column stays unenforced); ordering is never blocked by package
-- age. This migration adds no expiry logic.
--
-- Runs AFTER 20260630_02 so active_package_code can FK to bento_packages(code).
-- This migration DOES NOT touch deduction, triggers, balances, or pricing logic.
-- Apply manually in Supabase SQL Editor (staging first). Not applied by this draft.

begin;

alter table public.bento_customers
  add column if not exists account_type text not null default 'standard',
  add column if not exists active_package_code text,
  add column if not exists ordering_mode text not null default 'selectable',
  add column if not exists custom_price_per_meal numeric(10, 2),
  add column if not exists settlement_type text,
  add column if not exists custom_free_delivery boolean;

-- account_type: standard customer vs corporate/custom account (extensible).
alter table public.bento_customers
  drop constraint if exists bento_customers_account_type_check;
alter table public.bento_customers
  add constraint bento_customers_account_type_check
  check (account_type in ('standard', 'corporate'));

-- ordering_mode: per §0/D2 — only selectable + managed in V1.
alter table public.bento_customers
  drop constraint if exists bento_customers_ordering_mode_check;
alter table public.bento_customers
  add constraint bento_customers_ordering_mode_check
  check (ordering_mode in ('selectable', 'managed'));

-- settlement_type: corporate billing arrangement (nullable for standard).
alter table public.bento_customers
  drop constraint if exists bento_customers_settlement_type_check;
alter table public.bento_customers
  add constraint bento_customers_settlement_type_check
  check (settlement_type is null or settlement_type in ('prepaid', 'postpaid', 'invoice'));

-- active_package_code references the catalog (pkg_10/20/30). Existing rows are
-- NULL (no active package), so this adds no violation.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'bento_customers_active_package_code_fkey'
      and conrelid = 'public.bento_customers'::regclass
  ) then
    alter table public.bento_customers
      add constraint bento_customers_active_package_code_fkey
      foreign key (active_package_code)
      references public.bento_packages(code)
      on delete set null;
  end if;
end
$$;

commit;

-- Verification:
--   select column_name, data_type, column_default, is_nullable
--   from information_schema.columns
--   where table_schema = 'public' and table_name = 'bento_customers'
--     and column_name in ('account_type','active_package_code','ordering_mode',
--                         'custom_price_per_meal','settlement_type','custom_free_delivery')
--   order by column_name;
--
--   -- Existing rows took safe defaults:
--   select distinct account_type, ordering_mode from public.bento_customers;
--   -- expect only ('standard','selectable') until the later mapping step.
