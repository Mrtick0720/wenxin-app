-- Migration: Add audit and purchasing fields to purchase_items
-- Mirrors the purchase_checklist creator pattern and adds purchaser tracking.
-- purchase_method already exists for payment method.
-- Apply in Supabase SQL Editor.

ALTER TABLE public.purchase_items
  ADD COLUMN IF NOT EXISTS created_by_name text,
  ADD COLUMN IF NOT EXISTS purchased_by_user_id text,
  ADD COLUMN IF NOT EXISTS purchased_by_name text,
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'unpaid';

-- Backfill created_by_name from staff_profiles (only if any rows exist)
UPDATE public.purchase_items
  SET created_by_name = sp.display_name
  FROM public.staff_profiles sp
  WHERE purchase_items.created_by = sp.id
    AND purchase_items.created_by_name IS NULL;

-- Set default payment_status for existing rows
UPDATE public.purchase_items
  SET payment_status = 'paid'
  WHERE payment_status IS NULL;
