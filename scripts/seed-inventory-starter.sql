-- scripts/seed-inventory-starter.sql
-- Starter inventory seed for 文心砂锅 restaurant.
-- Safe to re-run: uses INSERT ... ON CONFLICT DO NOTHING.
-- Run AFTER all inventory migrations are applied.
-- Outlet ID: 00000000-0000-0000-0000-000000000001

DO $$
DECLARE
  c_outlet uuid := '00000000-0000-0000-0000-000000000001';
BEGIN

  -- ── Sauces (10 items) ─────────────────────────────────────────────
  INSERT INTO public.inventory_items
    (outlet_id, name, category, unit, reorder_level, reorder_point, par_level, lead_time_days, track_opened, status)
  VALUES
    (c_outlet, '牛肉面酱',     'Sauces', 'bottles', 1, 2, 8,  45, true, 'active'),
    (c_outlet, '金汤酸菜鱼酱', 'Sauces', 'tubs',    1, 2, 6,  45, true, 'active'),
    (c_outlet, '麻辣底料',     'Sauces', 'tubs',    1, 2, 6,  NULL, true, 'active'),
    (c_outlet, '辣椒油',       'Sauces', 'bottles', 1, 1, 4,  NULL, true, 'active'),
    (c_outlet, '豆瓣酱',       'Sauces', 'tubs',    1, 1, 3,  NULL, true, 'active'),
    (c_outlet, '生抽',         'Sauces', 'bottles', 1, 2, 6,  NULL, true, 'active'),
    (c_outlet, '老抽',         'Sauces', 'bottles', 1, 1, 3,  NULL, true, 'active'),
    (c_outlet, '蚝油',         'Sauces', 'bottles', 1, 1, 4,  NULL, true, 'active'),
    (c_outlet, '料酒',         'Sauces', 'bottles', 1, 1, 3,  NULL, true, 'active'),
    (c_outlet, '香醋',         'Sauces', 'bottles', 1, 1, 3,  NULL, true, 'active')
  ON CONFLICT DO NOTHING;

  -- ── Packaging (7 items) ───────────────────────────────────────────
  INSERT INTO public.inventory_items
    (outlet_id, name, category, unit, reorder_level, reorder_point, par_level, track_opened, status)
  VALUES
    (c_outlet, 'Bento Box M',    'Packaging', 'pcs',   100, 200, 1000, false, 'active'),
    (c_outlet, 'Bento Box L',    'Packaging', 'pcs',   75,  150, 800,  false, 'active'),
    (c_outlet, 'Soup Container', 'Packaging', 'pcs',   50,  100, 600,  false, 'active'),
    (c_outlet, 'Soup Lid',       'Packaging', 'pcs',   50,  100, 600,  false, 'active'),
    (c_outlet, 'Takeaway Bag',   'Packaging', 'pcs',   50,  100, 500,  false, 'active'),
    (c_outlet, 'Chopsticks',     'Packaging', 'pairs', 100, 200, 1000, false, 'active'),
    (c_outlet, 'Napkins',        'Packaging', 'packs', 1,   2,   10,   false, 'active')
  ON CONFLICT DO NOTHING;

  -- ── Dry Goods (8 items) ───────────────────────────────────────────
  INSERT INTO public.inventory_items
    (outlet_id, name, category, unit, reorder_level, reorder_point, par_level, track_opened, status)
  VALUES
    (c_outlet, 'Rice',           'Dry Goods', 'bags',    1, 2, 8,  false, 'active'),
    (c_outlet, 'Noodles',        'Dry Goods', 'cartons', 1, 2, 10, false, 'active'),
    (c_outlet, 'Corn Starch',    'Dry Goods', 'bags',    1, 1, 4,  false, 'active'),
    (c_outlet, 'Flour',          'Dry Goods', 'bags',    1, 1, 4,  false, 'active'),
    (c_outlet, 'Sugar',          'Dry Goods', 'bags',    1, 1, 4,  false, 'active'),
    (c_outlet, 'Salt',           'Dry Goods', 'bags',    1, 1, 4,  false, 'active'),
    (c_outlet, 'MSG',            'Dry Goods', 'bags',    1, 1, 4,  false, 'active'),
    (c_outlet, 'Chicken Powder', 'Dry Goods', 'tubs',    1, 1, 4,  false, 'active')
  ON CONFLICT DO NOTHING;

  -- Insert zero stock level rows for newly added items that don't yet have one
  INSERT INTO public.inventory_stock_levels (item_id, outlet_id, current_quantity)
  SELECT i.id, i.outlet_id, 0
  FROM public.inventory_items i
  WHERE i.outlet_id = c_outlet
    AND NOT EXISTS (
      SELECT 1 FROM public.inventory_stock_levels sl
      WHERE sl.item_id = i.id AND sl.outlet_id = c_outlet
    );

END $$;
