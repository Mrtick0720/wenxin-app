-- Migration: Bento package mode (scheduled vs balance)
-- Two kinds of package:
--   • scheduled — one meal per delivery day, projected daily circles to an end
--     date (e.g. Karen, ordering for her mother). Existing engine, unchanged.
--   • balance   — a quota of N portions consumed at a variable rate; orders are
--     created ad-hoc and deduct their quantity (e.g. Xhing Chee: 1/2/4 a day).
--     No projected daily schedule; the calendar shows only real order days.
-- Apply manually in Supabase SQL Editor.

BEGIN;

ALTER TABLE public.bento_customers
  ADD COLUMN IF NOT EXISTS package_mode text NOT NULL DEFAULT 'scheduled';

COMMIT;
