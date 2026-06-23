-- inventory_items: reorder planning fields (item configuration, rarely changes)
alter table public.inventory_items
  add column if not exists reorder_point  numeric(10,2) default null,
  add column if not exists lead_time_days integer       default null,
  add column if not exists location       text          default null,
  add column if not exists supplier       text          default null;

-- inventory_stock_levels: live count fields (changes frequently)
alter table public.inventory_stock_levels
  add column if not exists opened_quantity   numeric(10,2) not null default 0,
  add column if not exists on_order_quantity numeric(10,2) not null default 0,
  add column if not exists last_counted_at   timestamptz   default null;
