-- Migration: Add created_by_name to purchase_checklist
-- Tracks which staff member added each checklist item (denormalized for display).
-- Apply in Supabase SQL Editor.

ALTER TABLE public.purchase_checklist
  ADD COLUMN IF NOT EXISTS created_by_name text;

-- Backfill from staff_profiles where created_by is set
UPDATE public.purchase_checklist
  SET created_by_name = sp.display_name
  FROM public.staff_profiles sp
  WHERE purchase_checklist.created_by = sp.id
    AND purchase_checklist.created_by_name IS NULL;
