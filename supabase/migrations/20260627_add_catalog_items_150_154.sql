-- Migration: purchase_catalog — add 5 new items (seq 150–154)
-- ─────────────────────────────────────────────────────────────────────────────
-- New items:
--   150  缸豆        Kacang Panjang  Vegetables  kg
--   151  树仔菜      Sayur Manis     Vegetables  bag
--   152  小虾干      Udang Kering    Seafood     kg
--   153  冬荫功酱    Tom Yam Paste   Sauces      bottle
--   154  鱼露        Budu            Sauces      bottle
--
-- Note on 缸豆 vs 四季豆 (seq 20):
--   四季豆 (seq 20) = French beans / green beans (shorter, thick pods)
--   缸豆           = Yard-long beans (long, thin pods — 30-60 cm)
--   Both are legitimately different vegetables. Same Malay name (Kacang Panjang)
--   is acceptable as both are colloquially called that in Sabah.
--
-- Columns used: name_zh (Chinese), name_ms (Malay/display), category, unit.
-- name_en is intentionally excluded — it is not used by the application.
-- purchase_source defaults to 'local'; track_inventory defaults to true.
--
-- Safe to re-run: INSERT skips rows whose (name_zh, name_ms, category) already exist.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

INSERT INTO public.purchase_catalog (seq, name_zh, name_ms, category, unit)
SELECT v.seq, v.name_zh, v.name_ms, v.category, v.unit
FROM (VALUES
  (150, '缸豆',     'Kacang Panjang', 'Vegetables', 'kg'),
  (151, '树仔菜',   'Sayur Manis',    'Vegetables', 'bag'),
  (152, '小虾干',   'Udang Kering',   'Seafood',    'kg'),
  (153, '冬荫功酱', 'Tom Yam Paste',  'Sauces',     'bottle'),
  (154, '鱼露',     'Budu',           'Sauces',     'bottle')
) AS v(seq, name_zh, name_ms, category, unit)
WHERE NOT EXISTS (
  SELECT 1 FROM public.purchase_catalog p
  WHERE p.name_zh    = v.name_zh
    AND p.category   = v.category
    AND p.name_ms IS NOT DISTINCT FROM v.name_ms
);

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM public.purchase_catalog
      WHERE seq BETWEEN 150 AND 154) < 5 THEN
    RAISE EXCEPTION 'Expected 5 new catalog items (seq 150–154) — check for pre-existing rows with matching name_zh/name_ms/category';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.purchase_catalog WHERE name_zh = '缸豆'     AND category = 'Vegetables') THEN
    RAISE EXCEPTION '缸豆 not found in catalog';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.purchase_catalog WHERE name_zh = '树仔菜'   AND category = 'Vegetables') THEN
    RAISE EXCEPTION '树仔菜 not found in catalog';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.purchase_catalog WHERE name_zh = '小虾干'   AND category = 'Seafood') THEN
    RAISE EXCEPTION '小虾干 not found in catalog';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.purchase_catalog WHERE name_zh = '冬荫功酱' AND category = 'Sauces') THEN
    RAISE EXCEPTION '冬荫功酱 not found in catalog';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.purchase_catalog WHERE name_zh = '鱼露'     AND category = 'Sauces') THEN
    RAISE EXCEPTION '鱼露 not found in catalog';
  END IF;
END;
$$;

COMMIT;
