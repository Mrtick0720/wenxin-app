begin;

-- Enable realtime for bento_orders so Production sheet updates
-- immediately when any order is created, edited, or deleted.
alter publication supabase_realtime add table bento_orders;

commit;
