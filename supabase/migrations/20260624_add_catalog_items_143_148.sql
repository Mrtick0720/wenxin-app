-- Migration: add 6 new catalog items (seq 143–148)

INSERT INTO public.purchase_catalog (seq, name_ms, name_zh, name_en, category, unit) VALUES
  (143, 'Santan',          '椰奶',   'Santan',          'Grocery',   'carton'),
  (144, 'Cendawan Tiram',  '平菇',   'Oyster Mushroom', 'Vegetables','kg'),
  (145, 'Air pel',         '拖地水', 'Mopping water',   'Others',    'bottle'),
  (146, 'Benang daging',   '绑肉线', 'Butcher''s twine','Packaging', 'pcs'),
  (147, 'Biji Selasih',    '罗勒籽', 'Selasih',         'Beverage',  'pack'),
  (148, 'Belacan',         '马拉盏', 'Belachan',        'Grocery',   'pack')
ON CONFLICT DO NOTHING;

COMMIT;
