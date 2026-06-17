-- Add optional expected unit price to purchase_checklist
-- Apply in Supabase SQL Editor.

ALTER TABLE public.purchase_checklist
  ADD COLUMN IF NOT EXISTS unit_price numeric(10,2);
