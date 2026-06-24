-- Enable Supabase Realtime for purchase_items so Purchase pending
-- verification and received records converge across active devices.
--
-- Keep this idempotent because some Supabase projects may already have
-- purchase_items in the supabase_realtime publication.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'purchase_items'
  ) then
    alter publication supabase_realtime add table public.purchase_items;
  end if;
end $$;
