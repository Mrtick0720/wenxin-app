-- Bento orders: add payment detail fields
-- Existing `paid` boolean is kept for backward compat (BentoClient, UnpaidPage).
-- New columns capture richer payment state for accounting.

alter table public.bento_orders
  add column if not exists payment_status  text    not null default 'unpaid'
    check (payment_status in ('unpaid', 'paid', 'partial')),
  add column if not exists payment_method  text
    check (payment_method is null
           or payment_method in ('cash', 'qr', 'bank_transfer', 'other')),
  add column if not exists amount_paid     numeric not null default 0,
  add column if not exists payment_note    text    not null default '';

-- Back-fill payment_status from existing paid boolean so the new column is
-- consistent with legacy data (partial payments were not tracked before).
update public.bento_orders
set payment_status = case when paid = true then 'paid' else 'unpaid' end
where payment_status = 'unpaid';
