'use server'

import { requireRole } from '@/lib/auth/currentStaff'
import * as repo from '@/lib/attendance/repository'
import type { ShiftType, StaffShift } from '@/lib/attendance/types'

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }

/** Extract a human-readable string from any error shape.
 *  Supabase PostgrestError is a plain object with .message — not an Error instance.
 *  String(error) on a plain object produces "[object Object]". */
function fail(error: unknown): ActionResult<never> {
  let message: string
  if (error instanceof Error) {
    message = error.message
  } else if (error != null && typeof error === 'object' && 'message' in error) {
    // Supabase PostgrestError — has .message but is not an Error
    message = String((error as { message: unknown }).message)
  } else {
    message = String(error)
  }
  console.error('[staff actions]', message, error)
  return { ok: false, error: message }
}

export async function upsertStaffShiftAction(
  staffUserId: string,
  date: string,
  shiftType: ShiftType,
  shiftLabel?: string,
): Promise<ActionResult<StaffShift>> {
  try {
    await requireRole('owner', 'manager')
    const shift = await repo.upsertShift(staffUserId, date, shiftType, shiftLabel ?? '')
    return { ok: true, data: shift }
  } catch (error) {
    return fail(error)
  }
}

export async function fetchShiftsByDateAction(
  date: string,
): Promise<ActionResult<StaffShift[]>> {
  try {
    await requireRole('owner', 'manager', 'kitchen', 'front_desk', 'cashier', 'packing', 'delivery', 'other')
    const shifts = await repo.findShiftsByDate(date)
    return { ok: true, data: shifts }
  } catch (error) {
    return fail(error)
  }
}
