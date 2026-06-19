alter table public.reservations
  add column if not exists preordered_dishes text;
