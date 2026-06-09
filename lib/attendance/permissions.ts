// ── Attendance Permission Integration ──
// Uses the new Permission Layer (Phase 0) for Attendance module access control.
// Does NOT modify legacy permissions.ts or ROUTE_RULES.

import { hasPermission, hasAllPermissions } from '@/lib/auth/permissionCheck'
import { PERMISSION, type PermissionKey } from '@/lib/auth/permissionKeys'
import type { StaffRole } from '@/lib/auth/types'
import type { AttendanceAction } from './types'

const ACTION_PERMISSION_MAP: Record<AttendanceAction, PermissionKey[]> = {
  view_own:      [PERMISSION.VIEW_ATTENDANCE_SELF],
  view_all:      [PERMISSION.VIEW_ATTENDANCE_ALL],
  clock_in:      [PERMISSION.VIEW_ATTENDANCE_SELF, PERMISSION.EDIT_ATTENDANCE_SELF],
  clock_out:     [PERMISSION.VIEW_ATTENDANCE_SELF, PERMISSION.EDIT_ATTENDANCE_SELF],
  correct:       [PERMISSION.VIEW_ATTENDANCE_ALL, PERMISSION.EDIT_ATTENDANCE_ALL],
  manage_shifts: [PERMISSION.VIEW_STAFF_SCHEDULE, PERMISSION.EDIT_STAFF_SCHEDULE],
}

export function canPerformAttendanceAction(role: StaffRole, action: AttendanceAction): boolean {
  const required = ACTION_PERMISSION_MAP[action]
  if (!required) return false
  return hasAllPermissions(role, required)
}

export function canViewOwnAttendance(role: StaffRole): boolean {
  return hasPermission(role, PERMISSION.VIEW_ATTENDANCE_SELF)
}

export function canViewAllAttendance(role: StaffRole): boolean {
  return hasPermission(role, PERMISSION.VIEW_ATTENDANCE_ALL)
}

export function canClockIn(role: StaffRole): boolean {
  return hasPermission(role, PERMISSION.EDIT_ATTENDANCE_SELF)
}

export function canCorrectAttendance(role: StaffRole): boolean {
  return hasPermission(role, PERMISSION.EDIT_ATTENDANCE_ALL)
}

export function getAttendanceActionsForRole(role: StaffRole): AttendanceAction[] {
  return (Object.keys(ACTION_PERMISSION_MAP) as AttendanceAction[]).filter(action =>
    canPerformAttendanceAction(role, action)
  )
}
