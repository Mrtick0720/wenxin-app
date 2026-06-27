-- Migration: add 6 new catalog items (seq 143–148)

INSERT INTO public.purchase_catalog (seq, name_ms, name_zh, name_en, category, unit)
SELECT v.seq, v.name_ms, v.name_zh, v.name_en, v.category, v.unit
FROM (VALUES
  (143, 'Santan',          '椰奶',   'Santan',          'Grocery',   'carton'),
  (144, 'Cendawan Tiram',  '平菇',   'Oyster Mushroom', 'Vegetables','kg'),
  (145, 'Air pel',         '拖地水', 'Mopping water',   'Others',    'bottle'),
  (146, 'Benang daging',   '绑肉线', 'Butcher''s twine','Packaging', 'pcs'),
  (147, 'Biji Selasih',    '罗勒籽', 'Selasih',         'Beverage',  'pack'),
  (148, 'Belacan',         '马拉盏', 'Belachan',        'Grocery',   'pack')
) AS v(seq, name_ms, name_zh, name_en, category, unit)
WHERE NOT EXISTS (
  SELECT 1 FROM public.purchase_catalog p
  WHERE p.name_zh    = v.name_zh
    AND p.category   = v.category
    AND p.name_ms IS NOT DISTINCT FROM v.name_ms
);

COMMIT;
