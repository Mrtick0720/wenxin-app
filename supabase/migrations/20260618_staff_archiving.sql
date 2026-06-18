-- Staff archiving support
-- Adds archive lifecycle columns to staff_profiles

alter table staff_profiles
  add column if not exists archived boolean not null default false,
  add column if not exists archive_date timestamptz,
  add column if not exists archive_reason text,
  add column if not exists archived_by uuid references staff_profiles(id);

-- Index for filtering archived vs active staff
create index if not exists idx_staff_profiles_archived on staff_profiles(archived);
