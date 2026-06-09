// ── Suppliers Permission Integration ──
// Uses the new Permission Layer (Phase 0).

import { hasPermission, hasAllPermissions } from '@/lib/auth/permissionCheck'
import { PERMISSION, type PermissionKey } from '@/lib/auth/permissionKeys'
import type { StaffRole } from '@/lib/auth/types'
import type { SupplierAction } from './types'

const ACTION_PERMISSION_MAP: Record<SupplierAction, PermissionKey[]> = {
  view_suppliers:   [PERMISSION.VIEW_SUPPLIERS],
  edit_suppliers:   [PERMISSION.VIEW_SUPPLIERS, PERMISSION.EDIT_SUPPLIERS],
  manage_contacts:  [PERMISSION.VIEW_SUPPLIERS, PERMISSION.EDIT_SUPPLIERS],
}

export function canPerformSupplierAction(role: StaffRole, action: SupplierAction): boolean {
  const required = ACTION_PERMISSION_MAP[action]
  if (!required) return false
  return hasAllPermissions(role, required)
}

export function canViewSuppliers(role: StaffRole): boolean {
  return hasPermission(role, PERMISSION.VIEW_SUPPLIERS)
}

export function canEditSuppliers(role: StaffRole): boolean {
  return hasPermission(role, PERMISSION.EDIT_SUPPLIERS)
}

export function getSupplierActionsForRole(role: StaffRole): SupplierAction[] {
  return (Object.keys(ACTION_PERMISSION_MAP) as SupplierAction[]).filter(action =>
    canPerformSupplierAction(role, action)
  )
}
