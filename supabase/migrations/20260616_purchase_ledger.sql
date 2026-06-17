begin;

-- ═══════════════════════════════════════════════════════════════════
-- Purchase Ledger — extend `purchase_items` into a role-aware procurement
-- record system. Additive · idempotent.
--
--   • Adds: specification, purchaser, receiver, created_by
--     (created_at already exists on the live table)
--   • Replaces the single all-access RLS policy with role-scoped policies:
--       owner   → all history, all columns, insert/update/delete
--       manager → last 7 days, all columns, insert/update (no delete)
--       kitchen → today only, insert/update OWN rows, NO cost/supplier writes
--   • Cost-column HIDING for kitchen is enforced in the service layer (server
--     actions never SELECT cost columns for staff). RLS scopes rows as a backstop
--     and forbids staff from writing prices/supplier.
--
-- Does NOT touch purchase_requests / the request-approval system.
-- Depends on: public.staff_role_is(text[]), public.staff_profiles, auth.uid().
--
-- NOTE: purchase_items.date is a TEXT column storing 'YYYY-MM-DD' (verified: all
-- live values are valid). To stay error-proof against any malformed/legacy value
-- we compare as text (lexicographic order == chronological order for this format)
-- and cast the computed bound to text — we never cast the column to date, so a bad
-- value can never raise a per-row cast error that would abort an RLS query.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. New columns ──
alter table public.purchase_items
  add column if not exists specification text,
  add column if not exists purchaser     text,
  add column if not exists receiver       text,
  add column if not exists created_by     uuid references public.staff_profiles(id);

-- ── 2. Business-today helper (Asia/Kuching, UTC+8) — matches app `businessToday()` ──
create or replace function public.kk_today()
returns date
language sql
stable
as $$ select (now() at time zone 'Asia/Kuching')::date $$;

-- ── 3. Role-scoped RLS ──
alter table public.purchase_items enable row level security;

drop policy if exists staff_purchase_items_all on public.purchase_items;
drop policy if exists purchase_items_select on public.purchase_items;
drop policy if exists purchase_items_insert on public.purchase_items;
drop policy if exists purchase_items_update on public.purchase_items;
drop policy if exists purchase_items_delete on public.purchase_items;

-- SELECT: owner=all · manager=last 7 days · kitchen=today
create policy purchase_items_select on public.purchase_items
  for select to authenticated
  using (
    public.staff_role_is(array['owner'])
    or (public.staff_role_is(array['manager']) and date >= (public.kk_today() - 6)::text)
    or (public.staff_role_is(array['kitchen']) and date = public.kk_today()::text)
  );

-- INSERT: owner/manager any · kitchen only today, own authorship, no costs/supplier
create policy purchase_items_insert on public.purchase_items
  for insert to authenticated
  with check (
    public.staff_role_is(array['owner','manager'])
    or (
      public.staff_role_is(array['kitchen'])
      and date = public.kk_today()::text
      and created_by = auth.uid()
      and unit_price is null and total_price is null
      and actual_unit_price is null and actual_total_price is null
      and supplier is null
    )
  );

-- UPDATE: owner any · manager within 7 days · kitchen only own today, no costs/supplier
create policy purchase_items_update on public.purchase_items
  for update to authenticated
  using (
    public.staff_role_is(array['owner'])
    or (public.staff_role_is(array['manager']) and date >= (public.kk_today() - 6)::text)
    or (public.staff_role_is(array['kitchen']) and created_by = auth.uid() and date = public.kk_today()::text)
  )
  with check (
    public.staff_role_is(array['owner'])
    or (public.staff_role_is(array['manager']) and date >= (public.kk_today() - 6)::text)
    or (
      public.staff_role_is(array['kitchen'])
      and created_by = auth.uid()
      and date = public.kk_today()::text
      and unit_price is null and total_price is null
      and actual_unit_price is null and actual_total_price is null
      and supplier is null
    )
  );

-- DELETE: owner only
create policy purchase_items_delete on public.purchase_items
  for delete to authenticated
  using (public.staff_role_is(array['owner']));

-- ── 4. Validation ──
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'purchase_items'
      and column_name in ('specification','purchaser','receiver','created_by')
    group by table_name having count(*) = 4
  ) then
    raise exception 'purchase_items ledger columns are incomplete';
  end if;
end $$;

commit;
