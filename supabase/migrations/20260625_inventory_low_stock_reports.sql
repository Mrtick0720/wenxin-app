-- ═══════════════════════════════════════════════════════════════════
-- Inventory Low Stock Reports
-- Allows kitchen/front_desk staff to flag items as running low
-- without performing a formal stock count.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.inventory_low_stock_reports (
  id                uuid         primary key default gen_random_uuid(),
  item_id           bigint       not null references public.inventory_items(id) on delete cascade,
  outlet_id         uuid         not null,
  reported_by       uuid         not null references auth.users(id),
  report_type       text         not null,
  urgency           text         not null default 'normal',
  note              text,
  suggested_quantity numeric(10,2),
  status            text         not null default 'open',
  created_at        timestamptz  not null default now(),
  resolved_at       timestamptz,
  resolved_by       uuid         references auth.users(id),
  resolution_note   text,

  constraint inventory_low_stock_reports_report_type_check
    check (report_type in ('running_low', 'out_of_stock', 'needed_tomorrow', 'unusual_usage', 'other')),
  constraint inventory_low_stock_reports_urgency_check
    check (urgency in ('normal', 'urgent')),
  constraint inventory_low_stock_reports_status_check
    check (status in ('open', 'resolved'))
);

-- Index for the common query: open reports for a given outlet
create index if not exists inventory_low_stock_reports_outlet_status_idx
  on public.inventory_low_stock_reports(outlet_id, status, created_at desc);

-- Index for item-level lookups
create index if not exists inventory_low_stock_reports_item_idx
  on public.inventory_low_stock_reports(item_id, status);

-- ── RLS ──────────────────────────────────────────────────────────────
alter table public.inventory_low_stock_reports enable row level security;

-- All authenticated staff can read reports (badge display)
drop policy if exists inventory_low_stock_reports_select on public.inventory_low_stock_reports;
create policy inventory_low_stock_reports_select
  on public.inventory_low_stock_reports
  for select to authenticated
  using (true);

-- Any authenticated staff can insert; server action validates role/category
drop policy if exists inventory_low_stock_reports_insert on public.inventory_low_stock_reports;
create policy inventory_low_stock_reports_insert
  on public.inventory_low_stock_reports
  for insert to authenticated
  with check (reported_by = auth.uid());

-- Only owner/manager can update (resolve)
drop policy if exists inventory_low_stock_reports_update on public.inventory_low_stock_reports;
create policy inventory_low_stock_reports_update
  on public.inventory_low_stock_reports
  for update to authenticated
  using (public.staff_role_is(array['owner', 'manager']));
