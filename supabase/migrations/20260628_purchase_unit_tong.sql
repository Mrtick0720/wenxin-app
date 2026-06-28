-- supabase/migrations/20260628_purchase_unit_tong.sql
-- ═══════════════════════════════════════════════════════════════════
-- Add the `tong` unit for kitchen LPG gas (Malaysian "tong gas" cylinder).
--
-- `tong` is registered in the app's central unit list (lib/units.ts); the
-- `unit` columns are free text with no CHECK constraint, so no schema change
-- is needed — only the data below.
--
-- Gas (燃气) was historically recorded with placeholder units: the catalog
-- default and most rows used `pail`, and one pending checklist row used `tub`.
-- Both are wrong for gas — normalise every 燃气 row to `tong`.
--
-- Scope is strictly the gas item (name_zh / name = '燃气'); no other units or
-- items are touched. Safe to re-run (idempotent — WHERE matches gas only).
-- ═══════════════════════════════════════════════════════════════════

-- Master catalog — drives the default unit for newly added 燃气 items.
UPDATE public.purchase_catalog
SET unit = 'tong'
WHERE name_zh = '燃气' AND unit <> 'tong';

-- Active + historical purchase checklist rows for gas.
UPDATE public.purchase_checklist
SET unit = 'tong'
WHERE name = '燃气' AND unit <> 'tong';

-- Purchase ledger records for gas.
UPDATE public.purchase_items
SET unit = 'tong'
WHERE name = '燃气' AND unit <> 'tong';
