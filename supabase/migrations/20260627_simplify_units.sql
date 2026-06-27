-- supabase/migrations/20260627_simplify_units.sql
-- ═══════════════════════════════════════════════════════════════════
-- Simplify unit list: migrate removed units to kept equivalents.
--
-- Removed units and their replacements:
--   g       → kg     (use decimal kg; label change only, NOT quantity conversion)
--   ml      → L      (use decimal L; label change only, NOT quantity conversion)
--   packet  → pack
--   sachet  → pack
--   tin     → can
--   bundle  → bunch
--   pail    → bucket
--   set     → pcs
--   pair    → pcs
--   stick   → pcs
--   cup     → pcs    (food-service cup — count as pieces)
--   bowl    → pcs
--   plate   → pcs
--
-- Tables updated:
--   purchase_catalog   — master catalog (source of truth for default units)
--   inventory_items    — inventory master data
--   purchase_items     — purchase ledger records (runtime data)
--
-- Safe to re-run: WHERE clauses are exact, no-ops if already migrated.
-- ═══════════════════════════════════════════════════════════════════

-- ── purchase_catalog ────────────────────────────────────────────────

UPDATE public.purchase_catalog SET unit = 'kg'     WHERE unit = 'g';
UPDATE public.purchase_catalog SET unit = 'L'      WHERE unit = 'ml';
UPDATE public.purchase_catalog SET unit = 'pack'   WHERE unit = 'packet';
UPDATE public.purchase_catalog SET unit = 'pack'   WHERE unit = 'sachet';
UPDATE public.purchase_catalog SET unit = 'can'    WHERE unit = 'tin';
UPDATE public.purchase_catalog SET unit = 'bunch'  WHERE unit = 'bundle';
UPDATE public.purchase_catalog SET unit = 'bucket' WHERE unit = 'pail';
UPDATE public.purchase_catalog SET unit = 'pcs'    WHERE unit = 'set';
UPDATE public.purchase_catalog SET unit = 'pcs'    WHERE unit = 'pair';
UPDATE public.purchase_catalog SET unit = 'pcs'    WHERE unit = 'stick';
UPDATE public.purchase_catalog SET unit = 'pcs'    WHERE unit = 'cup';
UPDATE public.purchase_catalog SET unit = 'pcs'    WHERE unit = 'bowl';
UPDATE public.purchase_catalog SET unit = 'pcs'    WHERE unit = 'plate';

-- ── inventory_items ─────────────────────────────────────────────────

UPDATE public.inventory_items SET unit = 'kg'     WHERE unit = 'g';
UPDATE public.inventory_items SET unit = 'L'      WHERE unit = 'ml';
UPDATE public.inventory_items SET unit = 'pack'   WHERE unit = 'packet';
UPDATE public.inventory_items SET unit = 'pack'   WHERE unit = 'sachet';
UPDATE public.inventory_items SET unit = 'can'    WHERE unit = 'tin';
UPDATE public.inventory_items SET unit = 'bunch'  WHERE unit = 'bundle';
UPDATE public.inventory_items SET unit = 'bucket' WHERE unit = 'pail';
UPDATE public.inventory_items SET unit = 'pcs'    WHERE unit = 'set';
UPDATE public.inventory_items SET unit = 'pcs'    WHERE unit = 'pair';
UPDATE public.inventory_items SET unit = 'pcs'    WHERE unit = 'stick';
UPDATE public.inventory_items SET unit = 'pcs'    WHERE unit = 'cup';
UPDATE public.inventory_items SET unit = 'pcs'    WHERE unit = 'bowl';
UPDATE public.inventory_items SET unit = 'pcs'    WHERE unit = 'plate';

-- ── purchase_items ──────────────────────────────────────────────────

UPDATE public.purchase_items SET unit = 'kg'     WHERE unit = 'g';
UPDATE public.purchase_items SET unit = 'L'      WHERE unit = 'ml';
UPDATE public.purchase_items SET unit = 'pack'   WHERE unit = 'packet';
UPDATE public.purchase_items SET unit = 'pack'   WHERE unit = 'sachet';
UPDATE public.purchase_items SET unit = 'can'    WHERE unit = 'tin';
UPDATE public.purchase_items SET unit = 'bunch'  WHERE unit = 'bundle';
UPDATE public.purchase_items SET unit = 'bucket' WHERE unit = 'pail';
UPDATE public.purchase_items SET unit = 'pcs'    WHERE unit = 'set';
UPDATE public.purchase_items SET unit = 'pcs'    WHERE unit = 'pair';
UPDATE public.purchase_items SET unit = 'pcs'    WHERE unit = 'stick';
UPDATE public.purchase_items SET unit = 'pcs'    WHERE unit = 'cup';
UPDATE public.purchase_items SET unit = 'pcs'    WHERE unit = 'bowl';
UPDATE public.purchase_items SET unit = 'pcs'    WHERE unit = 'plate';
