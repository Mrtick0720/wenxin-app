-- Activate unit_price on purchase_checklist.
-- The column was declared in 20260617_checklist_unit_price.sql but was never wired
-- into the application. This migration ensures it exists before the app starts
-- writing last-price snapshots into it.
-- ADD COLUMN IF NOT EXISTS is idempotent — safe to re-apply.

ALTER TABLE public.purchase_checklist
  ADD COLUMN IF NOT EXISTS unit_price numeric(10,2);
