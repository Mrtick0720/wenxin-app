-- Migration: purchase_catalog — renames + master catalog fields
-- ─────────────────────────────────────────────────────────────────────────────
-- Part 1: Display name corrections (name_ms — the app's secondary display field)
--   seq 144: name_ms → "Golden Soup Base"
--            (sauce serves multiple golden soup dishes, not hot-and-sour only)
--   seq 72:  name_ms → "Chicken Hotpot Sauce"
--            (more natural English; reflects 鸡煲 cooking style)
--
-- Part 2: New master catalog columns
--   purchase_source  — where this item is sourced: local | china | both
--   track_inventory  — whether receiving this item creates inventory stock
--
-- Columns used: name_zh (Chinese), name_ms (Malay/display).
-- name_en is intentionally excluded — it is not used by the application.
--
-- Safe to re-run: ADD COLUMN IF NOT EXISTS is idempotent; UPDATEs are safe.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── Part 1: Renames (update name_ms — the secondary display field) ────────────

UPDATE public.purchase_catalog
SET name_ms = 'Golden Soup Base'
WHERE seq = 144 AND name_zh = '酸辣金汤酱';

UPDATE public.purchase_catalog
SET name_ms = 'Chicken Hotpot Sauce'
WHERE seq = 72 AND name_zh = '鸡煲酱';

-- ── Part 2: New columns ───────────────────────────────────────────────────────

ALTER TABLE public.purchase_catalog
  ADD COLUMN IF NOT EXISTS purchase_source text
    NOT NULL DEFAULT 'local'
    CHECK (purchase_source IN ('local', 'china', 'both')),
  ADD COLUMN IF NOT EXISTS track_inventory boolean
    NOT NULL DEFAULT true;

-- ── Part 3: Sensible overrides for non-tracked items ─────────────────────────
-- Gas, cleaning supplies, and pest control are consumed as-is;
-- tracking their stock level in inventory adds no value for this restaurant.

UPDATE public.purchase_catalog
SET track_inventory = false
WHERE name_zh IN ('燃气', '拖把', '杀虫剂', 'clorox 漂白剂', '洗碗水', '洗衣粉');

-- ── Validation ────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF (SELECT name_ms FROM public.purchase_catalog WHERE seq = 144 AND name_zh = '酸辣金汤酱')
      IS DISTINCT FROM 'Golden Soup Base' THEN
    RAISE EXCEPTION 'seq 144 rename failed — name_ms not updated';
  END IF;

  IF (SELECT name_ms FROM public.purchase_catalog WHERE seq = 72 AND name_zh = '鸡煲酱')
      IS DISTINCT FROM 'Chicken Hotpot Sauce' THEN
    RAISE EXCEPTION 'seq 72 rename failed — name_ms not updated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_catalog'
      AND column_name IN ('purchase_source', 'track_inventory')
    HAVING COUNT(*) = 2
  ) THEN
    RAISE EXCEPTION 'New columns purchase_source / track_inventory not found';
  END IF;
END;
$$;

COMMIT;
