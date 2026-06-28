'use server'

import { requireCurrentStaff, requireRole } from '@/lib/auth/currentStaff'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { isValidDateStr } from '@/lib/dateUtils'
import { resolveScheduleStatus } from '@/lib/schedule/resolveScheduleStatus'
import type { LeaveRequest, LeaveStatus, PublicHoliday, ResolvedDay, RosterDay } from '@/lib/schedule/types'
import * as repo from '@/lib/schedule/repository'

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(error: unknown): ActionResult<never> {
  let message: string
  if (error instanceof Error) message = error.message
  else if (error != null && typeof error === 'object' && 'message' in error) {
    message = String((error as { message: unknown }).message)
  } else message = String(error)
  console.error('[schedule action]', message, error)
  return { ok: false, error: message }
}

function requireDate(date: string): string {
  if (!isValidDateStr(date)) throw new Error('Invalid date')
  return date
}

// ── Resolved schedule (owner/manager: full roster) ──────────────────────────
export async function fetchScheduleForDateAction(
  date: string,
): Promise<ActionResult<{ roster: RosterDay[]; holiday: PublicHoliday | null }>> {
  try {
    await requireRole('owner', 'manager')
    requireDate(date)

    const [profiles, shifts, leaveIds, holiday, invitedIds] = await Promise.all([
      repo.getActiveNonOwnerProfiles(),
      repo.getShiftsMap(date),
      repo.getApprovedLeaveStaffIds(date),
      repo.getHoliday(date),
      repo.getInvitedStaffIds(date),
    ])

    const roster: RosterDay[] = profiles.map((p) => {
      const resolved = resolveScheduleStatus({
        date,
        fixedOffWeekday: p.fixedOffWeekday,
        approvedLeave: leaveIds.has(p.id),
        holiday,
        invitedToHoliday: invitedIds.has(p.id),
        shift: shifts.get(p.id) ?? null,
      })
      return {
        ...resolved,
        staffId: p.id,
        staffName: p.name,
        role: p.role,
        fixedOffWeekday: p.fixedOffWeekday,
      }
    })

    return { ok: true, data: { roster, holiday } }
  } catch (error) {
    return fail(error)
  }
}

// ── Resolved schedule (staff: own only) ─────────────────────────────────────
export async function fetchMyScheduleAction(
  date: string,
): Promise<ActionResult<{ day: ResolvedDay; fixedOffWeekday: number | null; holiday: PublicHoliday | null; hasProfile: boolean }>> {
  try {
    const staff = await requireCurrentStaff()
    requireDate(date)

    const [me, shift, approvedLeave, holiday, invited] = await Promise.all([
      repo.getProfileBrief(staff.id),
      repo.getMyShift(staff.id, date),
      repo.hasApprovedLeave(staff.id, date),
      repo.getHoliday(date),
      repo.isInvitedToHoliday(staff.id, date),
    ])
    const fixedOffWeekday = me?.fixedOffWeekday ?? null

    const day = resolveScheduleStatus({
      date,
      fixedOffWeekday,
      approvedLeave,
      holiday,
      invitedToHoliday: invited,
      shift,
    })

    return { ok: true, data: { day, fixedOffWeekday, holiday, hasProfile: me !== null } }
  } catch (error) {
    return fail(error)
  }
}

// ── Today's team on duty (all roles, privacy-safe via SECURITY DEFINER fn) ──
export async function fetchTeamOnDutyAction(
  date: string,
): Promise<ActionResult<{ staffId: string; name: string; role: string }[]>> {
  try {
    await requireCurrentStaff()
    requireDate(date)
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase.rpc('team_on_duty', { target_date: date })
    if (error) throw error
    const rows = (data ?? []) as Record<string, unknown>[]
    return {
      ok: true,
      data: rows.map((r) => ({
        staffId: r.staff_id as string,
        name: r.display_name as string,
        role: r.role as string,
      })),
    }
  } catch (error) {
    return fail(error)
  }
}

// ── Leave requests ──────────────────────────────────────────────────────────
export async function submitLeaveRequestAction(input: {
  startDate: string
  endDate: string
  reason: string
  notes?: string
}): Promise<ActionResult<null>> {
  try {
    const staff = await requireCurrentStaff()
    requireDate(input.startDate)
    requireDate(input.endDate)
    if (input.endDate < input.startDate) throw new Error('End date is before start date')
    const reason = input.reason.trim()
    if (!reason) throw new Error('Reason is required')

    await repo.insertLeaveRequest({
      staffId: staff.id,
      startDate: input.startDate,
      endDate: input.endDate,
      reason,
      notes: input.notes?.trim() || null,
    })
    return { ok: true, data: null }
  } catch (error) {
    return fail(error)
  }
}

export async function cancelLeaveRequestAction(id: number): Promise<ActionResult<null>> {
  try {
    await requireCurrentStaff() // RLS enforces own + pending
    await repo.cancelOwnLeaveRequest(id)
    return { ok: true, data: null }
  } catch (error) {
    return fail(error)
  }
}

export async function fetchMyLeaveRequestsAction(): Promise<ActionResult<LeaveRequest[]>> {
  try {
    const staff = await requireCurrentStaff()
    const data = await repo.listMyLeaveRequests(staff.id)
    return { ok: true, data }
  } catch (error) {
    return fail(error)
  }
}

export async function fetchLeaveRequestsAction(
  status?: LeaveStatus,
): Promise<ActionResult<LeaveRequest[]>> {
  try {
    await requireRole('owner', 'manager')
    const data = await repo.listAllLeaveRequests(status)
    return { ok: true, data }
  } catch (error) {
    return fail(error)
  }
}

export async function reviewLeaveRequestAction(
  id: number,
  decision: 'approved' | 'rejected',
): Promise<ActionResult<null>> {
  try {
    const reviewer = await requireRole('owner', 'manager')
    await repo.reviewLeaveRequest(id, decision, reviewer.id)
    return { ok: true, data: null }
  } catch (error) {
    return fail(error)
  }
}

// ── Fixed weekly off day (owner/manager set; admin client bypasses RLS) ──────
export async function setFixedOffDayAction(
  staffId: string,
  weekday: number | null,
): Promise<ActionResult<null>> {
  try {
    await requireRole('owner', 'manager')
    if (weekday !== null && (weekday < 0 || weekday > 6)) throw new Error('Invalid weekday')
    const admin = createAdminSupabaseClient()
    const { error } = await admin
      .from('staff_profiles')
      .update({ fixed_off_weekday: weekday })
      .eq('id', staffId)
    if (error) throw error
    return { ok: true, data: null }
  } catch (error) {
    return fail(error)
  }
}

// ── Public holidays ─────────────────────────────────────────────────────────
export async function fetchHolidaysAction(
  from: string,
  to: string,
): Promise<ActionResult<PublicHoliday[]>> {
  try {
    await requireCurrentStaff()
    requireDate(from)
    requireDate(to)
    const data = await repo.listHolidays(from, to)
    return { ok: true, data }
  } catch (error) {
    return fail(error)
  }
}

export async function addHolidayAction(
  date: string,
  name: string,
): Promise<ActionResult<null>> {
  try {
    await requireRole('owner', 'manager')
    requireDate(date)
    const trimmed = name.trim()
    if (!trimmed) throw new Error('Holiday name is required')
    await repo.insertHoliday(date, trimmed)
    return { ok: true, data: null }
  } catch (error) {
    return fail(error)
  }
}

export async function removeHolidayAction(id: number): Promise<ActionResult<null>> {
  try {
    await requireRole('owner', 'manager')
    await repo.deleteHoliday(id)
    return { ok: true, data: null }
  } catch (error) {
    return fail(error)
  }
}

// ── Holiday work invitations ────────────────────────────────────────────────
export async function fetchHolidayInvitesAction(
  date: string,
): Promise<ActionResult<string[]>> {
  try {
    await requireRole('owner', 'manager')
    requireDate(date)
    const set = await repo.getInvitedStaffIds(date)
    return { ok: true, data: [...set] }
  } catch (error) {
    return fail(error)
  }
}

export async function inviteToHolidayAction(
  date: string,
  staffId: string,
): Promise<ActionResult<null>> {
  try {
    const inviter = await requireRole('owner', 'manager')
    requireDate(date)
    await repo.insertInvitation(date, staffId, inviter.id)
    return { ok: true, data: null }
  } catch (error) {
    return fail(error)
  }
}

export async function removeHolidayInviteAction(
  date: string,
  staffId: string,
): Promise<ActionResult<null>> {
  try {
    await requireRole('owner', 'manager')
    requireDate(date)
    await repo.deleteInvitation(date, staffId)
    return { ok: true, data: null }
  } catch (error) {
    return fail(error)
  }
}
