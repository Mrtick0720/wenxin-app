// ── Inventory Permission Integration ──
// Uses the new Permission Layer (Phase 0).

import { hasPermission, hasAllPermissions } from '@/lib/auth/permissionCheck'
import { PERMISSION, type PermissionKey } from '@/lib/auth/permissionKeys'
import type { StaffRole } from '@/lib/auth/types'
import type { InventoryAction } from './types'

const ACTION_PERMISSION_MAP: Record<InventoryAction, PermissionKey[]> = {
  view_items:        [PERMISSION.VIEW_INVENTORY],
  edit_items:        [PERMISSION.VIEW_INVENTORY, PERMISSION.EDIT_INVENTORY],
  record_movement:   [PERMISSION.VIEW_INVENTORY, PERMISSION.EDIT_INVENTORY],
  record_adjustment: [PERMISSION.VIEW_INVENTORY, PERMISSION.EDIT_INVENTORY],
}

export function canPerformInventoryAction(role: StaffRole, action: InventoryAction): boolean {
  const required = ACTION_PERMISSION_MAP[action]
  if (!required) return false
  return hasAllPermissions(role, required)
}

export function canViewInventory(role: StaffRole): boolean {
  return hasPermission(role, PERMISSION.VIEW_INVENTORY)
}

export function canEditInventory(role: StaffRole): boolean {
  return hasPermission(role, PERMISSION.EDIT_INVENTORY)
}

export function getInventoryActionsForRole(role: StaffRole): InventoryAction[] {
  return (Object.keys(ACTION_PERMISSION_MAP) as InventoryAction[]).filter(action =>
    canPerformInventoryAction(role, action)
  )
}
