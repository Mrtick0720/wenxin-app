-- Wave 1 / Migration #2 — bento_packages catalog.
--
-- Source of truth: xin-bento-mobile/docs/MIGRATION_PLAN_V1.md §5.1 and
-- BACKEND_PLAN_V1.md §2. Additive, idempotent, reversible.
--
-- Static catalog of the three prepaid standard packages. Makes pricing
-- data-driven (a price change is a row edit, not code). Single orders (RM 18/meal)
-- and corporate/custom are NOT catalog rows — single = "no active package,
-- per-order"; corporate = custom pricing on the customer (see migration #4).
--
-- This migration DOES NOT touch deduction, triggers, balances, or pricing logic.
-- Apply manually in Supabase SQL Editor (staging first). Not applied by this draft.

begin;

create table if not exists public.bento_packages (
  code            text primary key,
  name            text not null,
  meals_count     integer not null check (meals_count > 0),
  price_per_meal  numeric(10, 2) not null check (price_per_meal >= 0),
  free_delivery   boolean not null default true,
  is_active       boolean not null default true,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Reuse the shared updated_at trigger (defined in staff authentication migration).
drop trigger if exists bento_packages_set_updated_at on public.bento_packages;
create trigger bento_packages_set_updated_at
before update on public.bento_packages
for each row execute function public.set_updated_at();

-- Seed the three standard packages (idempotent upsert).
insert into public.bento_packages
  (code, name, meals_count, price_per_meal, free_delivery, is_active, sort_order)
values
  ('pkg_10', '10-Meal Package', 10, 15.00, true, true, 10),
  ('pkg_20', '20-Meal Package', 20, 14.00, true, true, 20),
  ('pkg_30', '30-Meal Package', 30, 14.00, true, true, 30)
on conflict (code) do update
set name           = excluded.name,
    meals_count    = excluded.meals_count,
    price_per_meal = excluded.price_per_meal,
    free_delivery  = excluded.free_delivery,
    is_active      = excluded.is_active,
    sort_order     = excluded.sort_order,
    updated_at     = now();

-- RLS: lock the table down and give STAFF management access (consistent with every
-- other bento table). The customer-facing `authenticated` read policy is Wave 2
-- (MIGRATION_PLAN_V1.md #7) and is intentionally NOT added here.
alter table public.bento_packages enable row level security;
revoke all on table public.bento_packages from public, anon;
grant select, insert, update, delete on table public.bento_packages to authenticated;

drop policy if exists staff_bento_packages_select on public.bento_packages;
create policy staff_bento_packages_select on public.bento_packages
for select to authenticated
using (public.staff_role_is(array['owner', 'manager', 'kitchen', 'front_desk']));

drop policy if exists staff_bento_packages_write on public.bento_packages;
create policy staff_bento_packages_write on public.bento_packages
for all to authenticated
using (public.staff_role_is(array['owner', 'manager']))
with check (public.staff_role_is(array['owner', 'manager']));

commit;

-- Verification:
--   select code, meals_count, price_per_meal, free_delivery, is_active
--   from public.bento_packages order by sort_order;
--   -- expect exactly 3 active rows; prices 15 / 14 / 14; free_delivery = true.
