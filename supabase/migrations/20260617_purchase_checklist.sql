-- Migration: purchase_checklist table
-- Purpose: operational shopping checklist, separate from the financial ledger.
-- Kitchen/front submit requests; owner executes at the market and completes
-- items (which auto-creates a purchase_items record).
-- Apply in Supabase SQL Editor.

BEGIN;

CREATE TABLE IF NOT EXISTS public.purchase_checklist (
  id                 bigserial primary key,
  name               text not null,
  category           text not null default 'Vegetables',
  unit               text not null default 'kg',
  quantity           numeric(10, 3) not null,
  note               text,
  status             text not null default 'pending'
                       check (status in ('pending', 'done')),
  purchase_record_id integer references public.purchase_items(id) on delete set null,
  created_by         uuid,
  created_at         timestamptz not null default now(),
  completed_at       timestamptz
);

ALTER TABLE public.purchase_checklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "checklist readable by authenticated" ON public.purchase_checklist;
CREATE POLICY "checklist readable by authenticated"
  ON public.purchase_checklist FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "checklist writable by authenticated" ON public.purchase_checklist;
CREATE POLICY "checklist writable by authenticated"
  ON public.purchase_checklist FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

COMMIT;
