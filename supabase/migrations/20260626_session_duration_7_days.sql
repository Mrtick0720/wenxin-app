-- Extend staff session lifetime from 12 hours to 7 days.
--
-- Changes:
--   1. is_current_staff_session_valid() — check window: 12h → 7d
--   2. start_staff_session()            — expires_at formula: +12h → +7d
--   3. Active sessions backfill         — extend expires_at on currently-live sessions
--
-- The check in is_current_staff_session_valid() is the enforced gate;
-- expires_at in staff_sessions is used for display (Profile page) and
-- for StaffAccounts active-session queries.
--
-- Force Logout, account suspension, and sessions_invalidated_at logic
-- are untouched — those paths remain instant regardless of session length.

-- ── 1. is_current_staff_session_valid ────────────────────────────────────────

create or replace function public.is_current_staff_session_valid()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.staff_profiles p
    join auth.sessions s
      on s.user_id = p.id
     and s.id = public.current_session_id()
    where p.id = auth.uid()
      and p.active
      and s.created_at + interval '7 days' > now()
      and (
        p.sessions_invalidated_at is null
        or s.created_at > p.sessions_invalidated_at
      )
  );
$$;

-- ── 2. start_staff_session ────────────────────────────────────────────────────

create or replace function public.start_staff_session(device_summary text default '')
returns public.staff_sessions
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  session_row auth.sessions%rowtype;
  profile_row public.staff_profiles%rowtype;
  result public.staff_sessions%rowtype;
begin
  select * into session_row
  from auth.sessions
  where id = public.current_session_id()
    and user_id = auth.uid();

  if session_row.id is null then
    raise exception 'Authentication session is unavailable';
  end if;

  select * into profile_row
  from public.staff_profiles
  where id = auth.uid();

  if profile_row.id is null or not profile_row.active then
    raise exception 'Staff account is unavailable';
  end if;

  insert into public.staff_sessions (
    id,
    staff_user_id,
    staff_id,
    started_at,
    last_seen_at,
    expires_at,
    device_summary
  ) values (
    session_row.id,
    profile_row.id,
    profile_row.staff_id,
    session_row.created_at,
    now(),
    session_row.created_at + interval '7 days',
    left(coalesce(device_summary, ''), 240)
  )
  on conflict (id) do update
    set last_seen_at = now(),
        device_summary = excluded.device_summary
  returning * into result;

  update public.staff_profiles
  set last_login_at = now()
  where id = profile_row.id;

  perform public.write_auth_audit(
    'login',
    'staff_session',
    session_row.id::text,
    'Staff signed in'
  );

  return result;
end;
$$;

-- ── 3. Backfill active sessions ───────────────────────────────────────────────
-- Extend expires_at for sessions that are still live (not ended, not expired).
-- started_at is used as the base so the 7-day window is consistent with
-- what start_staff_session now writes for new sessions.

update public.staff_sessions
set    expires_at = started_at + interval '7 days'
where  ended_at is null
  and  expires_at > now();
