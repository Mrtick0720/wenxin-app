-- ═══════════════════════════════════════════════════════════════════
-- Checklist Linkage Columns for Incidents and Tasks
-- Enables Checklist Phase 2 incident/task generation.
-- All columns are nullable — backward compatible.
-- ═══════════════════════════════════════════════════════════════════

-- ── Incidents ──
alter table public.incidents
  add column if not exists checklist_instance_id bigint
  references public.checklist_instances(id) on delete set null;

alter table public.incidents
  add column if not exists reported_by uuid
  references public.staff_profiles(id);

-- ── Tasks ──
alter table public.tasks
  add column if not exists checklist_instance_id bigint
  references public.checklist_instances(id) on delete set null;

alter table public.tasks
  add column if not exists assigned_role text;
