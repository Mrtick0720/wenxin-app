-- Carry-over overuse for Bento balance/subscription packages.
--
-- opening_offset = meals pre-deducted at the START of the current package to
-- settle the PREVIOUS package's overuse. A fresh package with no carry-over is
-- 0. On renewal the app sets it to max(prev_offset + prev_used - prev_total, 0).
--
-- Idempotent: safe to run more than once.

alter table public.bento_customers
  add column if not exists opening_offset integer not null default 0;

comment on column public.bento_customers.opening_offset is
  'Meals pre-deducted at the start of the current package to settle the previous package''s overuse (0 = none).';
