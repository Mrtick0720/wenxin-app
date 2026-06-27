-- Migration: purchase_catalog — add Sauces category
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Move 4 existing Grocery items into the new Sauces category and fix units.
-- 2. Insert 7 genuinely new items (seq 143–149).
--
-- Columns used: name_zh (Chinese), name_ms (Malay/display), category, unit.
-- name_en is intentionally excluded — it is not used by the application.
--
-- Safe to re-run: UPDATE is idempotent; INSERT skips rows whose (name_zh, name_ms, category) already exist.
-- Companion code change: 'Sauces' added to PURCHASE_CATEGORIES in
--   lib/purchaseLedger/categories.ts
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Update existing catalog items ──────────────────────────────────────────

-- seq 71: 柱侯酱 — Grocery/kg → Sauces/tub
UPDATE public.purchase_catalog
SET category = 'Sauces',
    unit     = 'tub'
WHERE seq = 71 AND name_zh = '柱侯酱';

-- seq 72: 鸡煲酱 — Grocery/kg → Sauces/tub
UPDATE public.purchase_catalog
SET category = 'Sauces',
    unit     = 'tub'
WHERE seq = 72 AND name_zh = '鸡煲酱';

-- seq 74: 蒸鱼豉油 — Grocery/kg → Sauces/bottle
UPDATE public.purchase_catalog
SET category = 'Sauces',
    unit     = 'bottle'
WHERE seq = 74 AND name_zh = '蒸鱼豉油';

-- seq 76: 黄豆酱 — Grocery/kg → Sauces/tub
UPDATE public.purchase_catalog
SET category = 'Sauces',
    unit     = 'tub'
WHERE seq = 76 AND name_zh = '黄豆酱';

-- ── 2. Insert new items ───────────────────────────────────────────────────────

INSERT INTO public.purchase_catalog (seq, name_ms, name_zh, category, unit)
SELECT v.seq, v.name_ms, v.name_zh, v.category, v.unit
FROM (VALUES
  -- Sauces
  (143, 'Sos Daging Lembu Braised',  '红烧牛肉面酱',  'Sauces',    'tub'),
  (144, 'Sos Sup Emas',              '酸辣金汤酱',    'Sauces',    'tub'),
  (145, 'Cuka Baoning',              '保宁醋',        'Sauces',    'bottle'),
  -- Packaging
  (146, 'Kertas POS',                'POS机打印纸',   'Packaging', 'roll'),
  (147, 'Beg Pembungkus Custom',     '定制打包袋',    'Packaging', 'pcs'),
  (148, 'Straw / Penyedut',          '吸管',          'Packaging', 'pcs'),
  (149, 'Set Peralatan Pakai Buang', '一次性餐具套装', 'Packaging', 'set')
) AS v(seq, name_ms, name_zh, category, unit)
WHERE NOT EXISTS (
  SELECT 1 FROM public.purchase_catalog p
  WHERE p.name_zh    = v.name_zh
    AND p.category   = v.category
    AND p.name_ms IS NOT DISTINCT FROM v.name_ms
);

-- ── Validation ────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM public.purchase_catalog
      WHERE seq IN (71,72,74,76) AND category = 'Sauces') < 4 THEN
    RAISE EXCEPTION 'Expected 4 catalog items updated to Sauces category';
  END IF;

  IF (SELECT COUNT(*) FROM public.purchase_catalog
      WHERE seq BETWEEN 143 AND 149) < 7 THEN
    RAISE EXCEPTION 'Expected 7 new catalog items (seq 143–149)';
  END IF;
END;
$$;

COMMIT;
