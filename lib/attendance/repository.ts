// ── Attendance Repository Layer ──
// Data access for attendance operations. Abstracts Supabase queries.

import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { AttendanceSession, StaffShift } from './types'

const DEFAULT_OUTLET_ID = '00000000-0000-0000-0000-000000000001'

// ═══════════════════════════════════════════════════════════════════
// Attendance Sessions
// ═══════════════════════════════════════════════════════════════════

function mapSessionRow(row: Record<string, unknown>): AttendanceSession {
  return {
    id: row.id as number,
    outletId: row.outlet_id as string,
    staffUserId: row.staff_user_id as string,
    scheduleId: (row.schedule_id as number) ?? null,
    businessDate: row.business_date as string,
    clockIn: row.clock_in as string,
    clockOut: (row.clock_out as string) ?? null,
    clockMethod: row.clock_method as AttendanceSession['clockMethod'],
    endReason: (row.end_reason as AttendanceSession['endReason']) ?? null,
    correctionNote: (row.correction_note as string) ?? null,
    correctedBy: (row.corrected_by as string) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export async function createSession(session: {
  staffUserId: string
  scheduleId: number | null
  businessDate: string
  clockIn: string
  clockMethod?: string
  notes?: string | null
}): Promise<AttendanceSession> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('attendance_sessions')
    .insert({
      outlet_id: DEFAULT_OUTLET_ID,
      staff_user_id: session.staffUserId,
      schedule_id: session.scheduleId,
      business_date: session.businessDate,
      clock_in: session.clockIn,
      clock_method: session.clockMethod ?? 'app',
      notes: session.notes ?? null,
    })
    .select('*')
    .single()

  if (error) throw error
  return mapSessionRow(data)
}

export async function closeSession(
  sessionId: number,
  updates: {
    clockOut: string
    endReason: string
  },
): Promise<AttendanceSession> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('attendance_sessions')
    .update({
      clock_out: updates.clockOut,
      end_reason: updates.endReason,
    })
    .eq('id', sessionId)
    .select('*')
    .single()

  if (error) throw error
  return mapSessionRow(data)
}

export async function autoCloseOrphanedSession(
  staffUserId: string,
  closedAt: string,
): Promise<AttendanceSession | null> {
  const supabase = await createServerSupabaseClient()

  // Find the open session
  const { data: openSession } = await supabase
    .from('attendance_sessions')
    .select('*')
    .eq('staff_user_id', staffUserId)
    .is('clock_out', null)
    .order('clock_in', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!openSession) return null

  // Auto-close it
  const { data, error } = await supabase
    .from('attendance_sessions')
    .update({
      clock_out: closedAt,
      end_reason: 'auto_closed',
    })
    .eq('id', openSession.id)
    .select('*')
    .single()

  if (error) throw error
  return data ? mapSessionRow(data) : null
}

export async function findOpenSession(
  staffUserId: string,
): Promise<AttendanceSession | null> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('attendance_sessions')
    .select('*')
    .eq('staff_user_id', staffUserId)
    .is('clock_out', null)
    .order('clock_in', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data ? mapSessionRow(data) : null
}

export async function findSessionById(
  sessionId: number,
): Promise<AttendanceSession | null> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('attendance_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle()

  if (error) throw error
  return data ? mapSessionRow(data) : null
}

export async function findSessionsByDate(
  businessDate: string,
  outletId: string = DEFAULT_OUTLET_ID,
): Promise<AttendanceSession[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('attendance_sessions')
    .select('*')
    .eq('business_date', businessDate)
    .eq('outlet_id', outletId)
    .order('clock_in', { ascending: false })

  if (error) throw error
  return (data ?? []).map(mapSessionRow)
}

export async function findSessionsByStaff(
  staffUserId: string,
  limit = 30,
): Promise<AttendanceSession[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('attendance_sessions')
    .select('*')
    .eq('staff_user_id', staffUserId)
    .order('clock_in', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []).map(mapSessionRow)
}

export async function findTodaySessions(
  outletId: string = DEFAULT_OUTLET_ID,
): Promise<AttendanceSession[]> {
  const today = new Date().toISOString().split('T')[0]
  return findSessionsByDate(today, outletId)
}

// ═══════════════════════════════════════════════════════════════════
// Staff Shifts
// ═══════════════════════════════════════════════════════════════════

function mapShiftRow(row: Record<string, unknown>): StaffShift {
  return {
    id: row.id as number,
    staffUserId: row.staff_user_id as string,
    date: row.date as string,
    shiftType: row.shift_type as StaffShift['shiftType'],
    shiftLabel: (row.shift_label as string) ?? '',
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export async function findShiftsByDate(
  date: string,
): Promise<StaffShift[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('staff_shifts')
    .select('*')
    .eq('date', date)

  if (error) throw error
  return (data ?? []).map(mapShiftRow)
}

export async function findShiftByStaffAndDate(
  staffUserId: string,
  date: string,
): Promise<StaffShift | null> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('staff_shifts')
    .select('*')
    .eq('staff_user_id', staffUserId)
    .eq('date', date)
    .maybeSingle()

  if (error) throw error
  return data ? mapShiftRow(data) : null
}

export async function findLateThreshold(): Promise<number> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('restaurant_settings')
    .select('value')
    .eq('key', 'late_threshold_minutes')
    .maybeSingle()

  if (error || !data) return 15
  const parsed = parseInt(data.value, 10)
  return Number.isFinite(parsed) && parsed >= 5 && parsed <= 60 ? parsed : 15
}
