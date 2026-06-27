-- supabase/migrations/20260628_inventory_receive_stock.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Two changes:
--
-- 1. receive_inventory_stock RPC
--    Atomically adds received purchase quantity to existing stock.
--    Movement type: purchase_receive.
--    Restricted to owner / manager (checked inside the function).
--    For track_opened items: received quantity goes to unopened bucket;
--    opened_quantity is left unchanged.
--
-- 2. save_inventory_count update
--    Adds optional p_notes parameter so callers (e.g. CountItemSheet) can
--    store a human-readable reason in the movement record instead of the
--    generic "Count sheet: {category}" default.
--    Fully backwards-compatible: existing callers without p_notes continue
--    to work unchanged.
--    Based on the 20260627_inventory_seafood_category.sql version.
--
-- Safe to re-run: both CREATE OR REPLACE are idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. receive_inventory_stock ────────────────────────────────────────────────

create or replace function public.receive_inventory_stock(
  p_item_id  bigint,
  p_quantity numeric,
  p_notes    text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id     uuid;
  v_role         text;
  v_is_active    boolean;
  v_track_opened boolean;
  v_cur_qty      numeric;
  v_new_qty      numeric;
  c_outlet       constant uuid := '00000000-0000-0000-0000-000000000001';
begin

  select id, role, active
  into v_staff_id, v_role, v_is_active
  from public.staff_profiles
  where id = auth.uid();

  if not found or not v_is_active then
    raise exception 'No active staff profile found';
  end if;

  if v_role not in ('owner', 'manager') then
    raise exception 'Only owner or manager can receive stock';
  end if;

  if p_quantity <= 0 then
    raise exception 'Received quantity must be greater than zero';
  end if;

  -- Lock the stock level row and read current state atomically
  select ii.track_opened, isl.current_quantity
  into v_track_opened, v_cur_qty
  from public.inventory_items ii
  join public.inventory_stock_levels isl
    on isl.item_id = ii.id and isl.outlet_id = c_outlet
  where ii.id = p_item_id
    and ii.outlet_id = c_outlet
    and ii.status = 'active'
  for update of isl;

  if not found then
    raise exception 'Item % not found, inactive, or has no stock level row', p_item_id;
  end if;

  v_cur_qty := coalesce(v_cur_qty, 0);
  v_new_qty := v_cur_qty + p_quantity;

  -- Update stock level.
  -- For track_opened items: received stock is always unopened.
  -- We increment current_quantity (total). opened_quantity is unchanged
  -- so unopened = current_quantity - opened_quantity increases naturally.
  -- last_updated_at is set; last_counted_at is intentionally NOT set
  -- because receiving is not a count.
  update public.inventory_stock_levels
  set current_quantity = v_new_qty,
      last_updated_at  = now()
  where item_id = p_item_id
    and outlet_id = c_outlet;

  -- Record movement
  insert into public.inventory_movements
    (item_id, outlet_id, movement_type,
     quantity, previous_quantity, new_quantity,
     created_by, notes)
  values
    (p_item_id, c_outlet, 'purchase_receive',
     p_quantity, v_cur_qty, v_new_qty,
     v_staff_id,
     coalesce(p_notes, 'Stock received'));

end;
$$;

grant execute on function public.receive_inventory_stock(bigint, numeric, text) to authenticated;


-- ── 2. save_inventory_count (with optional p_notes) ──────────────────────────
-- Identical to 20260627_inventory_seafood_category.sql except:
--   • p_notes text default null parameter added
--   • movement notes: coalesce(p_notes, 'Count sheet: ' || p_category)

create or replace function public.save_inventory_count(
  p_entries  jsonb,
  p_category text,
  p_notes    text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id     uuid;
  v_role         text;
  v_is_active    boolean;
  v_entry        jsonb;
  v_item_id      bigint;
  v_new_qty      numeric;
  v_opened_qty   numeric;
  v_prev_qty     numeric;
  v_item_cat     text;
  v_track_opened boolean;
  c_outlet       constant uuid := '00000000-0000-0000-0000-000000000001';
begin

  select id, role, active
  into v_staff_id, v_role, v_is_active
  from public.staff_profiles
  where id = auth.uid();

  if not found or not v_is_active then
    raise exception 'No active staff profile found';
  end if;

  if not (
    v_role in ('owner', 'manager')
    or (v_role = 'kitchen'    and p_category in ('Seafood','Fresh','Sauces','Dry Goods','Packaging','Supplies'))
    or (v_role = 'front_desk' and p_category in ('Drinks','Packaging'))
  ) then
    raise exception 'Role % is not permitted to count category %', v_role, p_category;
  end if;

  for v_entry in select * from jsonb_array_elements(p_entries)
  loop
    v_item_id    := (v_entry->>'item_id')::bigint;
    v_new_qty    := (v_entry->>'new_quantity')::numeric;
    v_opened_qty := coalesce((v_entry->>'opened_quantity')::numeric, 0);

    if v_new_qty < 0 then
      raise exception 'Quantity cannot be negative for item %', v_item_id;
    end if;

    select category, track_opened
    into v_item_cat, v_track_opened
    from public.inventory_items
    where id = v_item_id and status = 'active';

    if not found then
      raise exception 'Item % not found or inactive', v_item_id;
    end if;

    if v_item_cat != p_category then
      raise exception 'Item % does not belong to category %', v_item_id, p_category;
    end if;

    select current_quantity into v_prev_qty
    from public.inventory_stock_levels
    where item_id = v_item_id and outlet_id = c_outlet;

    v_prev_qty := coalesce(v_prev_qty, 0);

    if v_track_opened then
      if v_opened_qty < 0 then
        raise exception 'Opened quantity cannot be negative for item %', v_item_id;
      end if;
      if v_opened_qty > v_new_qty then
        raise exception 'Opened quantity exceeds total for item %', v_item_id;
      end if;
      update public.inventory_stock_levels
      set current_quantity = v_new_qty,
          opened_quantity  = v_opened_qty,
          last_counted_at  = now(),
          last_updated_at  = now()
      where item_id = v_item_id and outlet_id = c_outlet;
    else
      update public.inventory_stock_levels
      set current_quantity = v_new_qty,
          last_counted_at  = now(),
          last_updated_at  = now()
      where item_id = v_item_id and outlet_id = c_outlet;
    end if;

    if not FOUND then
      raise exception 'No stock level row for item %', v_item_id;
    end if;

    insert into public.inventory_movements
      (item_id, outlet_id, movement_type,
       quantity, previous_quantity, new_quantity,
       created_by, notes)
    values
      (v_item_id, c_outlet, 'stock_check',
       v_new_qty - v_prev_qty,
       v_prev_qty,
       v_new_qty,
       v_staff_id,
       coalesce(p_notes, 'Count sheet: ' || p_category));

  end loop;
end;
$$;

grant execute on function public.save_inventory_count(jsonb, text, text) to authenticated;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'receive_inventory_stock'
  ) THEN
    RAISE EXCEPTION 'receive_inventory_stock RPC not found after creation';
  END IF;
END;
$$;

COMMIT;
