-- Migration: Kitchen daily work checklist (recurring + one-off + urgency)
-- Two kinds of kitchen work item shown on the Kitchen Home command center:
--   • Recurring routines  → stored as templates, auto-materialized each day
--   • One-off planned tasks → added straight onto a given day
-- Each item also carries an urgency level (0 normal / 1 urgent / 2 critical),
-- set when the task is created, surfaced in the kitchen list by colour + mark.
-- Kitchen staff tick items off; kitchen/manager/owner can all add & manage.
-- Fully idempotent — safe to (re-)run in Supabase SQL Editor.

BEGIN;

-- Recurring routine definitions (e.g. "Boil soup in the morning", "Clean kitchen").
CREATE TABLE IF NOT EXISTS public.kitchen_task_templates (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title       text        NOT NULL,
  urgency     smallint    NOT NULL DEFAULT 0,
  sort_order  int         NOT NULL DEFAULT 0,
  active      boolean     NOT NULL DEFAULT true,
  created_by  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Per-day task instances. template_id set → materialized from a recurring
-- routine; null → a one-off planned task for that day only.
CREATE TABLE IF NOT EXISTS public.kitchen_tasks (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date        date        NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kuala_Lumpur')::date,
  title       text        NOT NULL,
  urgency     smallint    NOT NULL DEFAULT 0,
  template_id bigint      REFERENCES public.kitchen_task_templates(id) ON DELETE SET NULL,
  sort_order  int         NOT NULL DEFAULT 0,
  done        boolean     NOT NULL DEFAULT false,
  done_by     text,
  done_at     timestamptz,
  created_by  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Add urgency to tables that already existed from an earlier run of this file.
ALTER TABLE public.kitchen_task_templates ADD COLUMN IF NOT EXISTS urgency smallint NOT NULL DEFAULT 0;
ALTER TABLE public.kitchen_tasks          ADD COLUMN IF NOT EXISTS urgency smallint NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS kitchen_tasks_date_idx ON public.kitchen_tasks (date);

-- One materialized instance per routine per day (lazy materialization on read
-- upserts against this constraint, so concurrent loads can't duplicate).
CREATE UNIQUE INDEX IF NOT EXISTS kitchen_tasks_date_template_uniq
  ON public.kitchen_tasks (date, template_id) WHERE template_id IS NOT NULL;

ALTER TABLE public.kitchen_task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchen_tasks          ENABLE ROW LEVEL SECURITY;

-- Authenticated staff may read and manage (operational shared lists).
DROP POLICY IF EXISTS kitchen_task_templates_all ON public.kitchen_task_templates;
CREATE POLICY kitchen_task_templates_all ON public.kitchen_task_templates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS kitchen_tasks_all ON public.kitchen_tasks;
CREATE POLICY kitchen_tasks_all ON public.kitchen_tasks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMIT;
