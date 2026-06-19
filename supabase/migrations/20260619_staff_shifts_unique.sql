begin;

-- Change staff_shifts unique constraint from (staff_id, shift_date, time_label)
-- to (staff_id, shift_date) so that each staff member has exactly one shift
-- assignment per date.  The old 3-column constraint allowed multiple rows for
-- the same staff+date when the time_label differed, which was unintended.

do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.staff_shifts'::regclass
    and contype = 'u'
    and conkey = (
      select array_agg(attnum order by attnum)
      from pg_attribute
      where attrelid = 'public.staff_shifts'::regclass
        and attname in ('staff_id', 'shift_date', 'time_label')
    );

  if constraint_name is not null then
    execute format('alter table public.staff_shifts drop constraint %I', constraint_name);
  end if;
end $$;

-- Remove duplicate rows before adding the new constraint.
-- Keep the row with the highest id for each staff+date pair.
delete from public.staff_shifts
where id not in (
  select max(id)
  from public.staff_shifts
  group by staff_id, shift_date
);

alter table public.staff_shifts
  add unique (staff_id, shift_date);

commit;
