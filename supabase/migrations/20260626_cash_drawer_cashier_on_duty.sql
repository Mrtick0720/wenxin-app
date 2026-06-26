-- supabase/migrations/20260626_cash_drawer_cashier_on_duty.sql
-- Additive only: adds cashier_on_duty_staff_id to cash_drawer_sessions.
-- Existing rows are unchanged (column is nullable, no backfill required).

alter table public.cash_drawer_sessions
  add column if not exists cashier_on_duty_staff_id uuid
    references public.staff_profiles(id) on delete set null;
