-- Enable Supabase Realtime for purchase_checklist so that cross-device
-- checklist changes (INSERT / UPDATE / DELETE) are broadcast to all
-- connected clients immediately.

alter publication supabase_realtime add table public.purchase_checklist;
