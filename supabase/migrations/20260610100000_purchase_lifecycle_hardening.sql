begin;

-- ═══════════════════════════════════════════════════════════════════
-- Purchase Phase 2.1 — Approval & Lifecycle Hardening
-- Depends on: 20260609_purchase.sql, 20260609_attendance.sql (restaurant_settings)
-- Additive · idempotent · UNAPPLIED (validate on staging before any prod apply)
--
-- Adds rejection/cancellation audit columns and approval config settings.
-- Lifecycle enforcement (tier, SoD, priced precondition, status guard) lives in
-- the service layer (purchaseLifecycleService); the optional trigger below is a
-- defense-in-depth backstop because the app uses the service role (bypasses RLS).
-- No new permission keys. No PO/receiving/invoice semantics.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Decision audit columns (approval/confirm columns already exist in Phase 1) ──
alter table public.purchase_requests
  add column if not exists rejected_by   uuid references public.staff_profiles(id),
  add column if not exists rejected_at   timestamptz,
  add column if not exists cancelled_by  uuid references public.staff_profiles(id),
  add column if not exists cancelled_at  timestamptz;

-- ── 2. Approval configuration (restaurant_settings: key text pk, value text) ──
insert into public.restaurant_settings (key, value) values
  ('purchase.approval.manager_limit', '500'),       -- RM ceiling a Manager may confirm (spend-commit)
  ('purchase.approval.allow_self_approve', 'true')  -- single-owner operation: requester may approve own
on conflict (key) do nothing;

-- ── 3. (Optional, defense-in-depth) status transition guard ──
-- Mirrors the service-layer STATUS_TRANSITIONS table. Service is the primary
-- enforcement; this backstops direct/service-role writes. Allowed edges:
--   draft     -> submitted | cancelled
--   submitted -> approved | rejected | draft | cancelled
--   approved  -> confirmed | cancelled
--   rejected  -> draft
--   confirmed -> purchased | cancelled
--   purchased -> (terminal) ; cancelled -> (terminal)
create or replace function public.purchase_request_status_guard()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    if not (
      (old.status = 'draft'     and new.status in ('submitted','cancelled')) or
      (old.status = 'submitted' and new.status in ('approved','rejected','draft','cancelled')) or
      (old.status = 'approved'  and new.status in ('confirmed','cancelled')) or
      (old.status = 'rejected'  and new.status in ('draft')) or
      (old.status = 'confirmed' and new.status in ('purchased','cancelled'))
    ) then
      raise exception 'illegal purchase_requests status transition: % -> %', old.status, new.status
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists purchase_request_status_guard on public.purchase_requests;
create trigger purchase_request_status_guard
  before update on public.purchase_requests
  for each row execute function public.purchase_request_status_guard();

-- ═══════════════════════════════════════════════════════════════════
-- Schema validation
-- ═══════════════════════════════════════════════════════════════════
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'purchase_requests'
      and column_name in ('rejected_by','rejected_at','cancelled_by','cancelled_at')
    group by table_name having count(*) = 4
  ) then
    raise exception 'purchase lifecycle audit columns are incomplete';
  end if;
end $$;

commit;
