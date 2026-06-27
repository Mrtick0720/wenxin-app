-- Migration: add 4 new catalog items (seq 139–142)

INSERT INTO public.purchase_catalog (seq, name_ms, name_zh, category, unit)
SELECT v.seq, v.name_ms, v.name_zh, v.category, v.unit
FROM (VALUES
  (139, 'Handmade Egg Mee', '手工鸡蛋面', 'Grocery', 'pack'),
  (140, 'Dumplings', '饺子', 'Grocery', 'pack'),
  (141, 'Daun Pudina', '薄荷叶', 'Vegetables', 'kg'),
  (142, 'Fish Maw', '花胶', 'Seafood', 'kg')
) AS v(seq, name_ms, name_zh, category, unit)
WHERE NOT EXISTS (
  SELECT 1 FROM public.purchase_catalog p
  WHERE p.name_zh    = v.name_zh
    AND p.category   = v.category
    AND p.name_ms IS NOT DISTINCT FROM v.name_ms
);

COMMIT;
