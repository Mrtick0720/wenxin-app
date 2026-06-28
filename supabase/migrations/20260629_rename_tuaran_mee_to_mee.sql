-- Migration: rename catalog item 斗亚兰面 (Tuaran Mee, seq 48) → 面条 / Mee
-- ─────────────────────────────────────────────────────────────────────────────
-- The item is being generalised from Tuaran-specific noodles to plain noodles.
--   Before: name_zh '斗亚兰面', name_ms 'Tuaran Mee', name_en 'Tuaran Noodles'
--   After:  name_zh '面条',     name_ms 'Mee',        name_en 'Mee'
-- Unit (kg) and category (Grocery) are unchanged.
--
-- Updates the existing row in place — no new row is created — so existing
-- purchase records that snapshotted the old item name keep their historical
-- value and are not affected.
--
-- Idempotent: the UPDATE only matches while the old name_zh is still present,
-- so re-running this migration is a no-op.
--
-- Note: 饺子 (Dumplings) requested alongside this rename already exists in the
-- catalog (seq 140, see 20260622_add_catalog_items.sql) with the requested
-- name_ms 'Dumplings', category 'Grocery', unit 'pack'. No new row is added to
-- avoid a duplicate.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

UPDATE public.purchase_catalog
SET name_zh = '面条',
    name_ms = 'Mee',
    name_en = 'Mee'
WHERE seq = 48 AND name_zh = '斗亚兰面';

-- ── Validation ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.purchase_catalog
    WHERE name_zh = '面条' AND name_ms = 'Mee' AND category = 'Grocery'
  ) THEN
    RAISE EXCEPTION '面条 / Mee not found after rename — seq 48 row missing or already changed unexpectedly';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.purchase_catalog
    WHERE name_zh = '斗亚兰面' AND active = true
  ) THEN
    RAISE EXCEPTION 'Old name 斗亚兰面 still present after rename';
  END IF;
END;
$$;

COMMIT;
