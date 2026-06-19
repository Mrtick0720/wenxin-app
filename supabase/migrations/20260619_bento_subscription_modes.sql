-- Bento customer subscription modes and database-enforced flexible credit accounting.
--
-- Apply this migration before deploying the UI that writes subscription_mode or customer_id.

begin;

-- 1. Customer subscription mode.
alter table public.bento_customers
  add column if not exists subscription_mode text not null default 'fixed',
  add column if not exists credit_expiry_date date;

alter table public.bento_customers
  drop constraint if exists bento_customers_subscription_mode_check;

alter table public.bento_customers
  add constraint bento_customers_subscription_mode_check
  check (subscription_mode in ('fixed', 'flexible'));

-- Preserve all existing customers as fixed schedules.
update public.bento_customers
set subscription_mode = 'fixed'
where subscription_mode is null;

-- 2. Stable customer linkage for orders.
alter table public.bento_orders
  add column if not exists customer_id bigint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bento_orders_customer_id_fkey'
      and conrelid = 'public.bento_orders'::regclass
  ) then
    alter table public.bento_orders
      add constraint bento_orders_customer_id_fkey
      foreign key (customer_id)
      references public.bento_customers(id)
      on delete set null;
  end if;
end
$$;

create index if not exists bento_orders_customer_id_date_idx
  on public.bento_orders(customer_id, date desc);

-- Backfill only authoritative subscription links. Do not infer IDs from names.
update public.bento_orders as orders
set customer_id = days.customer_id
from public.bento_subscription_days as days
where days.order_id = orders.id
  and orders.customer_id is distinct from days.customer_id;

-- 3. Flexible-credit accounting trigger.
create or replace function public.sync_bento_flexible_credits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_customer_id bigint;
  new_customer_id bigint;
  old_credit integer := 0;
  new_credit integer := 0;
  credit_delta integer := 0;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    old_customer_id := old.customer_id;
    if old.status = 'completed' and old.customer_id is not null then
      old_credit := greatest(coalesce(old.quantity, 1), 0)::integer;
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    new_customer_id := new.customer_id;
    if new.status = 'completed' and new.customer_id is not null then
      new_credit := greatest(coalesce(new.quantity, 1), 0)::integer;
    end if;
  end if;

  if old_customer_id is not distinct from new_customer_id then
    credit_delta := new_credit - old_credit;
    if new_customer_id is not null and credit_delta <> 0 then
      update public.bento_customers
      set used_portions = greatest(0, coalesce(used_portions, 0) + credit_delta)
      where id = new_customer_id
        and subscription_mode = 'flexible';
    end if;
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if old_customer_id is not null and old_credit <> 0 then
    update public.bento_customers
    set used_portions = greatest(0, coalesce(used_portions, 0) - old_credit)
    where id = old_customer_id
      and subscription_mode = 'flexible';
  end if;

  if new_customer_id is not null and new_credit <> 0 then
    update public.bento_customers
    set used_portions = greatest(0, coalesce(used_portions, 0) + new_credit)
    where id = new_customer_id
      and subscription_mode = 'flexible';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists bento_orders_sync_flexible_credits_insert_delete
  on public.bento_orders;

drop trigger if exists bento_orders_sync_flexible_credits_update
  on public.bento_orders;

drop trigger if exists bento_orders_sync_flexible_credits
  on public.bento_orders;

create trigger bento_orders_sync_flexible_credits_insert_delete
after insert or delete
on public.bento_orders
for each row
execute function public.sync_bento_flexible_credits();

create trigger bento_orders_sync_flexible_credits_update
after update of status, quantity, customer_id
on public.bento_orders
for each row
execute function public.sync_bento_flexible_credits();

commit;

-- Verification:
--
-- select subscription_mode, count(*)
-- from public.bento_customers
-- group by subscription_mode;
--
-- select id, name, subscription_mode, total_portions, used_portions,
--        delivery_frequency, start_date, credit_expiry_date
-- from public.bento_customers
-- order by id;
--
-- select count(*) filter (where customer_id is not null) as linked_orders,
--        count(*) filter (where customer_id is null) as unlinked_orders
-- from public.bento_orders;
