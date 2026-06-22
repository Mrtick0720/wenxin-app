-- Migration: Bento subscription periods (package ledger)
-- The business sells portion PACKAGES (N meals, delivered daily or weekdays
-- until used up) — there is no weekly/monthly calendar subscription concept.
-- Each completed package becomes one archived "period" row here, so a customer
-- can run many packages over time with full history. The CURRENT (active)
-- period stays mirrored on bento_customers (start_date/total_portions/
-- used_portions/delivery_frequency) so the existing schedule generator is
-- unchanged. Apply manually in Supabase SQL Editor.

BEGIN;

CREATE TABLE IF NOT EXISTS public.bento_subscription_periods (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id        bigint      NOT NULL REFERENCES public.bento_customers(id) ON DELETE CASCADE,
  period_no          int         NOT NULL DEFAULT 1,
  start_date         date,
  end_date           date,
  total_portions     int         NOT NULL DEFAULT 0,
  used_portions      int         NOT NULL DEFAULT 0,
  delivery_frequency text        NOT NULL DEFAULT 'daily',
  completed_at       timestamptz NOT NULL DEFAULT now(),
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bento_subscription_periods_customer_idx
  ON public.bento_subscription_periods (customer_id, period_no);

ALTER TABLE public.bento_subscription_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bento_subscription_periods_all ON public.bento_subscription_periods;
CREATE POLICY bento_subscription_periods_all ON public.bento_subscription_periods
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMIT;
