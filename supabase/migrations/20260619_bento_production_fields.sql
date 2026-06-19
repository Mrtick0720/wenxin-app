-- Bento production fields: kitchen-driven production data + A/B/C compartment model
-- Adds the operational + product columns the Production Sheet (KDS) is built on.
-- bento_orders already has: id, date, customer_name, phone, address, area,
--   menu_type, time_slot, items, note, amount, quantity, paid, status, value.

alter table public.bento_orders
  add column if not exists ready_by                time,
  add column if not exists fulfillment_type        text,
  add column if not exists delivery_or_pickup_time  time,
  add column if not exists pack_time               time,
  add column if not exists bento_items             text,
  add column if not exists compartment_a           text,
  add column if not exists compartment_b           text,
  add column if not exists compartment_c           text;

-- fulfillment_type may only be delivery / pickup (or null for legacy rows)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bento_orders_fulfillment_type_check'
  ) then
    alter table public.bento_orders
      add constraint bento_orders_fulfillment_type_check
      check (fulfillment_type is null or fulfillment_type in ('delivery', 'pickup'));
  end if;
end $$;

-- Recreate the kitchen-safe view, adding the new production columns.
-- Existing columns (incl. customer_name/address/note used by the kitchen bento
-- list) are preserved unchanged; the Production Sheet itself renders no customer
-- info by design, independent of what the view exposes.
do $$
begin
  if to_regclass('public.bento_orders') is not null then
    execute $view$
      create or replace view public.bento_kitchen_orders
      with (security_barrier = true)
      as
      select
        id,
        date,
        customer_name,
        address,
        area,
        menu_type,
        time_slot,
        items,
        note,
        quantity,
        status,
        bento_items,
        compartment_a,
        compartment_b,
        compartment_c,
        ready_by,
        fulfillment_type,
        delivery_or_pickup_time,
        pack_time
      from public.bento_orders
      where public.staff_role_is(array['owner', 'manager', 'kitchen'])
    $view$;
    execute 'revoke all on public.bento_kitchen_orders from public, anon';
    execute 'grant select on public.bento_kitchen_orders to authenticated';
  end if;
end $$;

-- Allow kitchen staff to update bento_orders so they can mark production
-- pending/completed from the Production Sheet. (owner/manager/front_desk already had it.)
do $$
begin
  if to_regclass('public.bento_orders') is not null then
    execute 'drop policy if exists staff_bento_orders_update on public.bento_orders';
    execute $policy$
      create policy staff_bento_orders_update on public.bento_orders
      for update to authenticated
      using (public.staff_role_is(array['owner', 'manager', 'front_desk', 'kitchen']))
      with check (public.staff_role_is(array['owner', 'manager', 'front_desk', 'kitchen']))
    $policy$;
  end if;
end $$;
