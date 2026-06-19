-- Per-customer delivery frequency for bento subscriptions.
--   daily    = deliver every day, including weekends and public holidays
--   weekdays = deliver Monday–Friday only (skip weekends)
-- Existing customers default to 'weekdays' to preserve current schedules.

alter table public.bento_customers
  add column if not exists delivery_frequency text not null default 'weekdays';

alter table public.bento_customers
  drop constraint if exists bento_customers_delivery_frequency_check;

alter table public.bento_customers
  add constraint bento_customers_delivery_frequency_check
  check (delivery_frequency in ('daily', 'weekdays'));

-- Karen (C001) delivers daily, including weekends.
update public.bento_customers set delivery_frequency = 'daily' where id = 1;
