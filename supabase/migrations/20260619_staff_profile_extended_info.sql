-- Extended employee information fields for Staff Details page
alter table staff_profiles
  add column if not exists phone    text,
  add column if not exists address  text,
  add column if not exists notes    text;
