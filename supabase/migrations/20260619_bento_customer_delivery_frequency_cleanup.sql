-- Data cleanup — kept separate from the delivery_frequency schema/business-logic change.
-- After Karen (C001) switches to daily delivery, her 30-meal window shortens from
-- Jul 27 (weekday schedule) to Jul 15 (daily schedule). Subscription days and their
-- generated orders beyond 2026-07-15 are now obsolete and must be cleared so no
-- phantom deliveries appear in the Production Sheet or Bento Orders.
--
-- Safe by construction:
--   * Only orders linked to Karen's subscription days after 2026-07-15 are affected.
--   * Completed (historical) orders are never canceled.
--   * used_portions, customer profile, and payment amounts are left untouched.
--
-- Order matters: cancel orders first (reads order_id from the rows), then delete the rows.

-- 1. Cancel obsolete generated orders beyond the new end date (flips status only; payment rows kept).
update public.bento_orders
set status = 'canceled'
where id in (
  select order_id
  from public.bento_subscription_days
  where customer_id = 1
    and date > '2026-07-15'
    and order_id is not null
)
and status <> 'completed';

-- 2. Remove the obsolete subscription day rows beyond the new end date.
delete from public.bento_subscription_days
where customer_id = 1
  and date > '2026-07-15';
