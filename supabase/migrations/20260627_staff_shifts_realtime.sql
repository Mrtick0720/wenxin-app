-- Enable Supabase Realtime for staff_shifts so the "My Today's Shift" home
-- card updates live when an owner/manager edits a staff member's schedule
-- from another session.
--
-- Keep this idempotent because some Supabase projects may already have
-- staff_shifts in the supabase_realtime publication.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'staff_shifts'
  ) then
    alter publication supabase_realtime add table public.staff_shifts;
  end if;
end $$;
