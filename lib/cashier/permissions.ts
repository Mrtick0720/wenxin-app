// ── Cashier Permission Integration ──
// Uses the new Permission Layer (Phase 0) for Cashier module access control.
// Does NOT modify legacy permissions.ts or ROUTE_RULES.

import { hasPermission, hasAllPermissions } from '@/lib/auth/permissionCheck'
import { PERMISSION, type PermissionKey } from '@/lib/auth/permissionKeys'
import type { StaffRole } from '@/lib/auth/types'
import type { CashierAction } from './types'

/**
 * Map a CashierAction to the PermissionKey(s) required to perform it.
 * Some actions require multiple permissions (ALL must be held).
 */
const ACTION_PERMISSION_MAP: Record<CashierAction, PermissionKey[]> = {
  view_shift:       [PERMISSION.VIEW_CASHIER],
  open_shift:       [PERMISSION.VIEW_CASHIER, PERMISSION.OPERATE_CASHIER],
  close_shift:      [PERMISSION.VIEW_CASHIER, PERMISSION.CLOSE_CASHIER_SHIFT],
  record_payment:   [PERMISSION.VIEW_CASHIER, PERMISSION.OPERATE_CASHIER],
  make_adjustment:  [PERMISSION.VIEW_CASHIER, PERMISSION.OPERATE_CASHIER],
  verify_shift:    [PERMISSION.VIEW_CASHIER, PERMISSION.CLOSE_CASHIER_SHIFT],
  view_reports:     [PERMISSION.VIEW_CASHIER],
  manage_settings:  [PERMISSION.VIEW_CASHIER],
}

/**
 * Check if a role can perform a specific cashier action.
 */
export function canPerformCashierAction(role: StaffRole, action: CashierAction): boolean {
  const requiredPermissions = ACTION_PERMISSION_MAP[action]
  if (!requiredPermissions) return false
  return hasAllPermissions(role, requiredPermissions)
}

/**
 * Check if a role can view the cashier module at all.
 */
export function canViewCashier(role: StaffRole): boolean {
  return hasPermission(role, PERMISSION.VIEW_CASHIER)
}

/**
 * Check if a role can operate the cashier (record payments, make adjustments).
 */
export function canOperateCashier(role: StaffRole): boolean {
  return hasPermission(role, PERMISSION.OPERATE_CASHIER)
}

/**
 * Check if a role can close a cashier shift.
 */
export function canCloseShift(role: StaffRole): boolean {
  return hasPermission(role, PERMISSION.CLOSE_CASHIER_SHIFT)
}

/**
 * Get all cashier actions a role can perform. Useful for UI rendering.
 */
export function getCashierActionsForRole(role: StaffRole): CashierAction[] {
  return (Object.keys(ACTION_PERMISSION_MAP) as CashierAction[]).filter(action =>
    canPerformCashierAction(role, action)
  )
}
