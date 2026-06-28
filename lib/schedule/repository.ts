// ── Staff Scheduling Repository ──
// Server-side data access for fixed off days, leave requests, public holidays
// and holiday work invitations. All reads/writes go through the request-scoped
// Supabase client, so Row Level Security applies: a normal staff caller only
// ever sees their own leave/shift/invitation rows; owner/manager see all.

import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { ShiftType } from '@/lib/attendance/types'
import type { LeaveRequest, LeaveStatus, PublicHoliday } from './types'

export type ProfileBrief = {
  id: string
  name: string
  role: string
  fixedOffWeekday: number | null
}

export type ShiftBrief = { shiftType: ShiftType; shiftLabel: string }

// ── Profiles ──────────────────────────────────────────────────────────────
export async function getActiveNonOwnerProfiles(): Promise<ProfileBrief[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('staff_profiles')
    .select('id, display_name, role, fixed_off_weekday')
    .eq('active', true)
    .eq('archived', false)
    .neq('role', 'owner')
  if (error) throw error
  return (data ?? []).map((p: Record<string, unknown>) => ({
    id: p.id as string,
    name: p.display_name as string,
    role: p.role as string,
    fixedOffWeekday: (p.fixed_off_weekday as number | null) ?? null,
  }))
}

// ── Shifts (manual overrides) ───────────────────────────────────────────────
export async function getShiftsMap(date: string): Promise<Map<string, ShiftBrief>> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('staff_shifts')
    .select('staff_id, shift_type, time_label')
    .eq('shift_date', date)
  if (error) throw error
  return new Map(
    (data ?? []).map((s: Record<string, unknown>) => [
      s.staff_id as string,
      { shiftType: s.shift_type as ShiftType, shiftLabel: (s.time_label as string) || '' },
    ]),
  )
}

// ── Approved leave covering a date ──────────────────────────────────────────
export async function getApprovedLeaveStaffIds(date: string): Promise<Set<string>> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('staff_leave_requests')
    .select('staff_id')
    .eq('status', 'approved')
    .lte('start_date', date)
    .gte('end_date', date)
  if (error) throw error
  return new Set((data ?? []).map((r: Record<string, unknown>) => r.staff_id as string))
}

// ── Public holidays ─────────────────────────────────────────────────────────
function mapHoliday(row: Record<string, unknown>): PublicHoliday {
  return {
    id: row.id as number,
    date: row.holiday_date as string,
    name: row.name as string,
    isPaid: (row.is_paid as boolean) ?? true,
  }
}

export async function getHoliday(date: string): Promise<PublicHoliday | null> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('public_holidays')
    .select('*')
    .eq('holiday_date', date)
    .maybeSingle()
  if (error) throw error
  return data ? mapHoliday(data) : null
}

export async function listHolidays(from: string, to: string): Promise<PublicHoliday[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('public_holidays')
    .select('*')
    .gte('holiday_date', from)
    .lte('holiday_date', to)
    .order('holiday_date')
  if (error) throw error
  return (data ?? []).map(mapHoliday)
}

export async function insertHoliday(date: string, name: string): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('public_holidays')
    .insert({ holiday_date: date, name })
  if (error) throw error
}

export async function deleteHoliday(id: number): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('public_holidays').delete().eq('id', id)
  if (error) throw error
}

// ── Holiday work invitations ────────────────────────────────────────────────
export async function getInvitedStaffIds(date: string): Promise<Set<string>> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('public_holiday_work_invitations')
    .select('staff_id')
    .eq('holiday_date', date)
  if (error) throw error
  return new Set((data ?? []).map((r: Record<string, unknown>) => r.staff_id as string))
}

export async function insertInvitation(
  date: string,
  staffId: string,
  invitedBy: string,
): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('public_holiday_work_invitations')
    .upsert(
      { holiday_date: date, staff_id: staffId, invited_by: invitedBy },
      { onConflict: 'holiday_date,staff_id' },
    )
  if (error) throw error
}

export async function deleteInvitation(date: string, staffId: string): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('public_holiday_work_invitations')
    .delete()
    .eq('holiday_date', date)
    .eq('staff_id', staffId)
  if (error) throw error
}

// ── Leave requests ──────────────────────────────────────────────────────────
function mapLeave(row: Record<string, unknown>): LeaveRequest {
  const profile = row.staff_profiles as Record<string, unknown> | null
  return {
    id: row.id as number,
    staffId: row.staff_id as string,
    staffName: (profile?.display_name as string) ?? undefined,
    staffRole: (profile?.role as string) ?? undefined,
    startDate: row.start_date as string,
    endDate: row.end_date as string,
    reason: (row.reason as string) ?? '',
    notes: (row.notes as string) ?? null,
    status: row.status as LeaveStatus,
    reviewedBy: (row.reviewed_by as string) ?? null,
    reviewedAt: (row.reviewed_at as string) ?? null,
    createdAt: row.created_at as string,
  }
}

// Owner/manager: every request (optionally filtered by status), with staff names.
export async function listAllLeaveRequests(status?: LeaveStatus): Promise<LeaveRequest[]> {
  const supabase = await createServerSupabaseClient()
  let query = supabase
    .from('staff_leave_requests')
    .select('*, staff_profiles!staff_leave_requests_staff_id_fkey(display_name, role)')
    .order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(mapLeave)
}

// Staff: only the caller's own requests (RLS scopes this, but filter anyway).
export async function listMyLeaveRequests(staffId: string): Promise<LeaveRequest[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('staff_leave_requests')
    .select('*')
    .eq('staff_id', staffId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapLeave)
}

export async function insertLeaveRequest(input: {
  staffId: string
  startDate: string
  endDate: string
  reason: string
  notes: string | null
}): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('staff_leave_requests').insert({
    staff_id: input.staffId,
    start_date: input.startDate,
    end_date: input.endDate,
    reason: input.reason,
    notes: input.notes,
    status: 'pending',
  })
  if (error) throw error
}

export async function cancelOwnLeaveRequest(id: number): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('staff_leave_requests')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function reviewLeaveRequest(
  id: number,
  decision: 'approved' | 'rejected',
  reviewerId: string,
): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('staff_leave_requests')
    .update({
      status: decision,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error
}
