-- Add planning details to purchase checklist items.
-- These fields are informational until the item is converted into a purchase record.

ALTER TABLE public.purchase_checklist
  ADD COLUMN IF NOT EXISTS specification text,
  ADD COLUMN IF NOT EXISTS supplier text;
