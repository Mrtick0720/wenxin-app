-- Wave 1 / Migration #1 — Customer auth link + account claim foundation.
--
-- Source of truth: xin-bento-mobile/docs/MIGRATION_PLAN_V1.md §5.3 and
-- BACKEND_PLAN_V1.md §1. Additive, idempotent, reversible.
--
-- Purpose: let a logged-in customer (auth.users row, NOT staff) link to exactly
-- one bento_customers row. Provider-agnostic: linkage is by auth_user_id only, so
-- Google / email today and Apple / Phone / Facebook later attach to the same row
-- with no further schema change. Per §0/D12 all customer orders (incl. single
-- orders) require login — there is no guest path.
--
-- This migration DOES NOT touch deduction, triggers, balances, or pricing.
-- Apply manually in Supabase SQL Editor (staging first). Not applied by this draft.

begin;

-- 1. Linkage + claim-hint columns on bento_customers (additive, nullable).
alter table public.bento_customers
  add column if not exists auth_user_id uuid;

alter table public.bento_customers
  add column if not exists email text;

-- auth_user_id references the Supabase auth user and is unique (one customer row
-- per auth user). Null = staff-created record not yet claimed.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'bento_customers_auth_user_id_fkey'
      and conrelid = 'public.bento_customers'::regclass
  ) then
    alter table public.bento_customers
      add constraint bento_customers_auth_user_id_fkey
      foreign key (auth_user_id)
      references auth.users(id)
      on delete set null;
  end if;
end
$$;

create unique index if not exists bento_customers_auth_user_id_key
  on public.bento_customers(auth_user_id)
  where auth_user_id is not null;

-- 2. Account-claim RPC.
--    Links auth.uid() to one unclaimed bento_customers row by normalized
--    (digit-only) phone. Idempotent. If multiple unclaimed rows match -> error
--    ("contact staff"), never guess. If none match -> create a new owned row.
--
--    NOTE on the auto-create path: the committed baseline for bento_customers is
--    "Inferred" (no CREATE TABLE migration on disk), so the insert defensively
--    populates the columns the staff app is known to use. Columns that carry their
--    own defaults (package_mode, subscription_mode, delivery_frequency) are left to
--    those defaults. VERIFY on staging that no other NOT NULL column lacks a
--    default before applying.
create or replace function public.claim_customer_account(claim_phone text)
returns bigint
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  caller uuid := auth.uid();
  normalized text;
  match_count integer := 0;
  existing_id bigint;
  matched_id bigint;
  new_id bigint;
  caller_email text;
  caller_name text;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;

  -- Idempotent: caller already linked.
  select id into existing_id
  from public.bento_customers
  where auth_user_id = caller
  limit 1;
  if existing_id is not null then
    return existing_id;
  end if;

  normalized := nullif(regexp_replace(coalesce(claim_phone, ''), '[^0-9]', '', 'g'), '');

  if normalized is not null then
    select count(*) into match_count
    from public.bento_customers
    where auth_user_id is null
      and regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') = normalized;

    if match_count > 1 then
      raise exception
        'Multiple customer records match this phone number; please contact staff.';
    elsif match_count = 1 then
      select id into matched_id
      from public.bento_customers
      where auth_user_id is null
        and regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') = normalized
      limit 1;

      select email into caller_email from auth.users where id = caller;

      update public.bento_customers
      set auth_user_id = caller,
          email = coalesce(email, caller_email)
      where id = matched_id;

      return matched_id;
    end if;
  end if;

  -- No match -> create a new owned customer row (standard, no package yet).
  select email into caller_email from auth.users where id = caller;
  select coalesce(
           raw_user_meta_data ->> 'full_name',
           raw_user_meta_data ->> 'name',
           caller_email,
           'New Customer'
         )
    into caller_name
  from auth.users
  where id = caller;

  insert into public.bento_customers (
    name, phone, auth_user_id, email,
    subscription_type, delivery_method, delivery_address, area,
    menu_preference, taste_notes, start_date,
    total_portions, used_portions, note, active
  )
  values (
    coalesce(caller_name, 'New Customer'), normalized, caller, caller_email,
    'monthly', 'delivery', '', '',
    '', '', current_date,
    0, 0, '', true
  )
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.claim_customer_account(text) from public, anon;
grant execute on function public.claim_customer_account(text) to authenticated;

commit;

-- Verification (run as a normal SQL editor session = owner role):
--   select column_name, data_type, is_nullable
--   from information_schema.columns
--   where table_schema = 'public' and table_name = 'bento_customers'
--     and column_name in ('auth_user_id', 'email');
--
--   -- Unique partial index present:
--   select indexname from pg_indexes
--   where tablename = 'bento_customers' and indexname = 'bento_customers_auth_user_id_key';
--
--   -- Function present + executable by authenticated:
--   select proname, prosecdef from pg_proc where proname = 'claim_customer_account';
