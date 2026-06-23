-- ═══════════════════════════════════════════════════════════════════
-- Inventory Sample Seed Data
-- Purpose: Visual verification of the Inventory page UI
-- Safe to re-run: uses ON CONFLICT DO UPDATE (idempotent)
-- Run manually in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════
--
-- Expected UI result after running:
--
--   Attention tab shows 4 items:
--     OUT OF STOCK  → 牛肉面酱
--     LOW STOCK     → Bok Choy
--     NEED REORDER  → 金汤酸菜鱼酱  (sauce card with reorder warning)
--     NEED COUNT    → Bento Box (M)  (last counted 20 days ago)
--
--   All tab shows all 5 items (including White Rice — OK)
--   Sauces tab shows 金汤酸菜鱼酱 and 牛肉面酱
--   Fresh tab shows Bok Choy
--   Dry Goods tab shows White Rice
--   Packaging tab shows Bento Box (M)
--
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_id bigint;
begin

  -- ── 1. 金汤酸菜鱼酱 ── NEED REORDER ──────────────────────────────
  -- qty 3 is above reorder_level (2) but at/below reorder_point (6)
  -- Shows sauce card with: "Reorder at 6 tubs · Lead time 45 days"
  insert into public.inventory_items
    (name, category, unit, reorder_level, reorder_point, lead_time_days, location, supplier, status)
  values
    ('金汤酸菜鱼酱', 'Sauces', 'tubs', 2, 6, 45, 'Sauce Shelf A', 'Ah Keong 进口', 'active')
  on conflict (outlet_id, name) do update
    set reorder_level  = excluded.reorder_level,
        reorder_point  = excluded.reorder_point,
        lead_time_days = excluded.lead_time_days,
        location       = excluded.location,
        supplier       = excluded.supplier
  returning id into v_id;

  insert into public.inventory_stock_levels
    (item_id, current_quantity, opened_quantity, on_order_quantity, last_counted_at)
  values
    (v_id, 3, 1, 0, now())
  on conflict (item_id, outlet_id) do update
    set current_quantity  = excluded.current_quantity,
        opened_quantity   = excluded.opened_quantity,
        on_order_quantity = excluded.on_order_quantity,
        last_counted_at   = excluded.last_counted_at;

  -- ── 2. 牛肉面酱 ── OUT OF STOCK ──────────────────────────────────
  -- qty 0 → status = out
  insert into public.inventory_items
    (name, category, unit, reorder_level, location, status)
  values
    ('牛肉面酱', 'Sauces', 'bottles', 3, 'Sauce Shelf B', 'active')
  on conflict (outlet_id, name) do update
    set reorder_level = excluded.reorder_level,
        location      = excluded.location
  returning id into v_id;

  insert into public.inventory_stock_levels
    (item_id, current_quantity, last_counted_at)
  values
    (v_id, 0, now())
  on conflict (item_id, outlet_id) do update
    set current_quantity = excluded.current_quantity,
        last_counted_at  = excluded.last_counted_at;

  -- ── 3. Bok Choy ── LOW STOCK ──────────────────────────────────────
  -- qty 2 <= reorder_level 5 → status = low
  insert into public.inventory_items
    (name, category, unit, reorder_level, location, status)
  values
    ('Bok Choy', 'Fresh', 'kg', 5, 'Walk-in Fridge', 'active')
  on conflict (outlet_id, name) do update
    set reorder_level = excluded.reorder_level,
        location      = excluded.location
  returning id into v_id;

  insert into public.inventory_stock_levels
    (item_id, current_quantity, last_counted_at)
  values
    (v_id, 2, now())
  on conflict (item_id, outlet_id) do update
    set current_quantity = excluded.current_quantity,
        last_counted_at  = excluded.last_counted_at;

  -- ── 4. White Rice ── OK ───────────────────────────────────────────
  -- qty 25, reorder_level 10, recently counted → status = ok
  -- Should NOT appear in Attention tab
  insert into public.inventory_items
    (name, category, unit, reorder_level, location, status)
  values
    ('White Rice', 'Dry Goods', 'kg', 10, 'Dry Storage', 'active')
  on conflict (outlet_id, name) do update
    set reorder_level = excluded.reorder_level,
        location      = excluded.location
  returning id into v_id;

  insert into public.inventory_stock_levels
    (item_id, current_quantity, last_counted_at)
  values
    (v_id, 25, now())
  on conflict (item_id, outlet_id) do update
    set current_quantity = excluded.current_quantity,
        last_counted_at  = excluded.last_counted_at;

  -- ── 5. Bento Box (M) ── NEED COUNT ───────────────────────────────
  -- qty 250 > reorder_level 100, no reorder_point → would be ok
  -- BUT last_counted_at is 20 days ago → exceeds 14-day Packaging threshold
  -- → status = need_count
  insert into public.inventory_items
    (name, category, unit, reorder_level, location, status)
  values
    ('Bento Box (M)', 'Packaging', 'pcs', 100, 'Storage Room', 'active')
  on conflict (outlet_id, name) do update
    set reorder_level = excluded.reorder_level,
        location      = excluded.location
  returning id into v_id;

  insert into public.inventory_stock_levels
    (item_id, current_quantity, last_counted_at)
  values
    (v_id, 250, now() - interval '20 days')
  on conflict (item_id, outlet_id) do update
    set current_quantity = excluded.current_quantity,
        last_counted_at  = excluded.last_counted_at;

end $$;
