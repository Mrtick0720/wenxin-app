-- Migration: 3-step purchase verification workflow
-- Adds verification/rejection audit columns to purchase_items.
-- Migrates existing records: status 'pending' → 'verified' (they were manually entered and are complete).
-- New checklist-triggered records use 'pending_verification'.
-- Applied manually in Supabase SQL Editor on 2026-06-21.

BEGIN;

ALTER TABLE public.purchase_items
  ADD COLUMN IF NOT EXISTS verified_by_name    text,
  ADD COLUMN IF NOT EXISTS verified_at         timestamptz,
  ADD COLUMN IF NOT EXISTS received_quantity   numeric(10,3),
  ADD COLUMN IF NOT EXISTS rejected_by_name    text,
  ADD COLUMN IF NOT EXISTS rejected_at         timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason    text;

UPDATE public.purchase_items
  SET status = 'verified'
  WHERE status = 'pending' OR status IS NULL;

COMMIT;
