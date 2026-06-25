-- supabase/migrations/20260625_cash_drawer.sql
-- ═══════════════════════════════════════════════════════════════════
-- Cash Drawer V1
-- cash_drawer_sessions  — immutable FeedMe import data
-- cash_adjustments      — Wenxin-managed, soft-deleted
-- ═══════════════════════════════════════════════════════════════════

begin;

-- ── cash_drawer_sessions ─────────────────────────────────────────────
create table if not exists public.cash_drawer_sessions (
  id                    bigserial        primary key,
  business_date         date             not null,
  counter               text             not null,
  outlet_id             uuid             not null,
  outlet_name           text,

  open_time             timestamptz,
  close_time            timestamptz,
  opened_by             text,
  closed_by             text,

  opening_float         numeric(10,2),
  closing_float         numeric(10,2),

  cash_sales            numeric(10,2),
  pay_in                numeric(10,2),
  pay_out               numeric(10,2),

  alipay                numeric(10,2),
  duitnow               numeric(10,2),
  maybank_qr            numeric(10,2),
  touchngo              numeric(10,2),
  wechat                numeric(10,2),

  source                text             not null default 'manual_import',
  raw_source_payload    jsonb,
  imported_at           timestamptz,
  imported_by           uuid             references auth.users(id),
  created_at            timestamptz      not null default now(),

  constraint cash_drawer_sessions_source_check
    check (source in ('manual_import', 'feedme_relay')),
  constraint cash_drawer_sessions_unique_date_counter_outlet
    unique (business_date, counter, outlet_id)
);

create index if not exists cash_drawer_sessions_date_outlet_idx
  on public.cash_drawer_sessions(outlet_id, business_date desc);

alter table public.cash_drawer_sessions enable row level security;

-- SELECT: owner + manager
drop policy if exists cash_drawer_sessions_select on public.cash_drawer_sessions;
create policy cash_drawer_sessions_select
  on public.cash_drawer_sessions
  for select to authenticated
  using (public.staff_role_is(array['owner', 'manager']));

-- INSERT: owner only
drop policy if exists cash_drawer_sessions_insert on public.cash_drawer_sessions;
create policy cash_drawer_sessions_insert
  on public.cash_drawer_sessions
  for insert to authenticated
  with check (public.staff_role_is(array['owner']));

-- UPDATE: nobody (no policy = no access — immutable by design)

-- DELETE: owner only (re-import correction)
drop policy if exists cash_drawer_sessions_delete on public.cash_drawer_sessions;
create policy cash_drawer_sessions_delete
  on public.cash_drawer_sessions
  for delete to authenticated
  using (public.staff_role_is(array['owner']));

-- ── cash_adjustments ─────────────────────────────────────────────────
create table if not exists public.cash_adjustments (
  id                    bigserial        primary key,
  business_date         date             not null,
  outlet_id             uuid             not null,
  session_id            bigint           references public.cash_drawer_sessions(id) on delete set null,

  adjustment_type       text             not null,
  amount                numeric(10,2)    not null,
  quantity              integer,
  reference_no          text,
  receipt_url           text,
  category              text,
  note                  text,

  status                text             not null default 'approved',
  approved_by           uuid             references auth.users(id),
  approved_at           timestamptz,

  created_by            uuid             not null references auth.users(id),
  created_at            timestamptz      not null default now(),

  deleted_at            timestamptz,
  deleted_by            uuid             references auth.users(id),

  constraint cash_adjustments_type_check
    check (adjustment_type in ('coupon','voucher','refund','manual_adjustment','pay_out','other')),
  constraint cash_adjustments_status_check
    check (status in ('draft','pending_approval','approved','rejected'))
);

create index if not exists cash_adjustments_date_outlet_idx
  on public.cash_adjustments(outlet_id, business_date desc)
  where deleted_at is null;

alter table public.cash_adjustments enable row level security;

-- SELECT: owner + manager
drop policy if exists cash_adjustments_select on public.cash_adjustments;
create policy cash_adjustments_select
  on public.cash_adjustments
  for select to authenticated
  using (public.staff_role_is(array['owner', 'manager']));

-- INSERT: owner + manager
drop policy if exists cash_adjustments_insert on public.cash_adjustments;
create policy cash_adjustments_insert
  on public.cash_adjustments
  for insert to authenticated
  with check (public.staff_role_is(array['owner', 'manager']));

-- UPDATE: owner + manager (application layer only writes deleted_at + deleted_by)
drop policy if exists cash_adjustments_update on public.cash_adjustments;
create policy cash_adjustments_update
  on public.cash_adjustments
  for update to authenticated
  using (public.staff_role_is(array['owner', 'manager']))
  with check (public.staff_role_is(array['owner', 'manager']));

-- DELETE: nobody (hard delete disabled; soft delete only)

commit;
