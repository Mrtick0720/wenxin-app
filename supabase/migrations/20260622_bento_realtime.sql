begin;

-- Enable realtime for bento_weekly_menu_assignments so New Order
-- pages update immediately when the weekly menu is edited.
alter publication supabase_realtime add table bento_weekly_menu_assignments;

commit;
