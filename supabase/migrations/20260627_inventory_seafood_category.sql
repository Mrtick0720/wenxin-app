-- Migration: add Seafood as a first-class inventory category
-- ─────────────────────────────────────────────────────────────────────────────
-- Seafood items (e.g. Fish Maw / 花胶, Prawns, Crab Meat) have category
-- 'Seafood' in purchase_catalog. The save_inventory_count RPC had a hardcoded
-- list of categories that kitchen staff are allowed to count — Seafood was
-- missing, so kitchen could not submit a count for any Seafood inventory item.
--
-- This migration replaces the RPC with an updated version that includes Seafood
-- in kitchen's allowed categories. The RPC logic is otherwise unchanged.
--
-- Safe to re-run: CREATE OR REPLACE is idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

create or replace function public.save_inventory_count(
  p_entries  jsonb,
  p_category text
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
       'Count sheet: ' || p_category);

  end loop;
end;
$$;

grant execute on function public.save_inventory_count(jsonb, text) to authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'save_inventory_count'
  ) THEN
    RAISE EXCEPTION 'save_inventory_count RPC not found after replacement';
  END IF;
END;
$$;

COMMIT;
