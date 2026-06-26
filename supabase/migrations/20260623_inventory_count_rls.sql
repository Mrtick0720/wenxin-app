-- ═══════════════════════════════════════════════════════════════════
-- Inventory Count Sheet — RLS + RPC
-- Phase: Count Sheet
-- Safe to re-run: all statements are idempotent
-- ═══════════════════════════════════════════════════════════════════

-- ── Fix front_desk SELECT access (v1 gap) ────────────────────────
-- front_desk was added to requireRole in fetchInventoryAction (v1) but
-- the RLS policies on these tables never included front_desk.
-- Without these, front_desk gets empty results despite passing requireRole.

drop policy if exists inventory_items_frontdesk_read on public.inventory_items;
create policy inventory_items_frontdesk_read
  on public.inventory_items
  for select to authenticated
  using (public.staff_role_is(array['front_desk']));

drop policy if exists inventory_stock_levels_frontdesk_read on public.inventory_stock_levels;
create policy inventory_stock_levels_frontdesk_read
  on public.inventory_stock_levels
  for select to authenticated
  using (public.staff_role_is(array['front_desk']));

-- ── save_inventory_count RPC ──────────────────────────────────────
-- SECURITY DEFINER: bypasses RLS for writes.
-- All auth, role, and category checks are performed inside the function.
-- The function derives staff identity from auth.uid() — callers cannot
-- spoof who counted. previous_quantity is read from the DB, never from
-- the client. A movement row is inserted for every item, even delta=0.

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
  v_staff_id   uuid;
  v_role       text;
  v_is_active  boolean;
  v_entry      jsonb;
  v_item_id    bigint;
  v_new_qty    numeric;
  v_opened_qty numeric;
  v_prev_qty   numeric;
  v_item_cat   text;
  c_outlet     constant uuid := '00000000-0000-0000-0000-000000000001';
begin

  -- Step 1: identify caller via auth.uid()
  -- staff_profiles.id = auth.uid() (confirmed in auth migration)
  -- staff_profiles uses `active boolean`, not a status text column
  select id, role, active
  into v_staff_id, v_role, v_is_active
  from public.staff_profiles
  where id = auth.uid();

  if not found or not v_is_active then
    raise exception 'No active staff profile found';
  end if;

  -- Step 2: validate role is permitted to count this category
  if not (
    v_role in ('owner', 'manager')
    or (v_role = 'kitchen'    and p_category in ('Fresh','Sauces','Dry Goods','Packaging','Supplies'))
    or (v_role = 'front_desk' and p_category in ('Drinks','Packaging'))
  ) then
    raise exception 'Role % is not permitted to count category %', v_role, p_category;
  end if;

  -- Step 3: process each entry atomically
  -- PL/pgSQL functions run in an implicit transaction —
  -- any exception rolls back all writes in this loop.
  for v_entry in select * from jsonb_array_elements(p_entries)
  loop
    v_item_id    := (v_entry->>'item_id')::bigint;
    v_new_qty    := (v_entry->>'new_quantity')::numeric;
    v_opened_qty := coalesce((v_entry->>'opened_quantity')::numeric, 0);

    -- Reject negative total quantity
    if v_new_qty < 0 then
      raise exception 'Quantity cannot be negative for item %', v_item_id;
    end if;

    -- Verify item exists, is active, and belongs to p_category
    select category into v_item_cat
    from public.inventory_items
    where id = v_item_id and status = 'active';

    if not found then
      raise exception 'Item % not found or inactive', v_item_id;
    end if;

    if v_item_cat != p_category then
      raise exception 'Item % does not belong to category %', v_item_id, p_category;
    end if;

    -- Read previous_quantity from the DB — never trust the client
    select current_quantity into v_prev_qty
    from public.inventory_stock_levels
    where item_id = v_item_id and outlet_id = c_outlet;

    v_prev_qty := coalesce(v_prev_qty, 0);

    -- Update stock level
    -- Sauce items: update opened_quantity
    -- All other categories: leave opened_quantity UNCHANGED
    if p_category = 'Sauces' then
      if v_opened_qty < 0 then
        raise exception 'Opened quantity cannot be negative for item %', v_item_id;
      end if;
      if v_opened_qty > v_new_qty then
        raise exception 'Opened quantity exceeds total quantity for item %', v_item_id;
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
      -- opened_quantity is intentionally not touched for non-Sauce items
    end if;

    -- Reject if no stock level row existed — prevents orphan movement records.
    -- All active items should have a stock level row (created by createInventoryItem).
    -- If FOUND is false, the UPDATE above touched 0 rows; roll back the whole batch.
    if not FOUND then
      raise exception 'No stock level row found for item %. Cannot record count.', v_item_id;
    end if;

    -- Insert movement record for every item, including zero-delta counts.
    -- This is the proof-of-count and the only attribution record for who counted.
    -- created_by = v_staff_id derived from auth.uid() above, never from client.
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

-- Grant execute to all authenticated users.
-- The function enforces its own auth and category checks internally
-- (security definer bypasses RLS for writes; auth is in-function).
grant execute on function public.save_inventory_count(jsonb, text) to authenticated;
