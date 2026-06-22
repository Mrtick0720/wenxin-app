-- Migration: add 4 new catalog items (seq 139–142)

INSERT INTO public.purchase_catalog (seq, name_ms, name_zh, category, unit) VALUES
  (139, 'Handmade Egg Mee', '手工鸡蛋面', 'Grocery', 'pack'),
  (140, 'Dumplings', '饺子', 'Grocery', 'pack'),
  (141, 'Daun Pudina', '薄荷叶', 'Vegetables', 'kg'),
  (142, 'Fish Maw', '花胶', 'Seafood', 'kg')
ON CONFLICT DO NOTHING;

COMMIT;
