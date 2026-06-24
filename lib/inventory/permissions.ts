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

// ── Count Sheet permission map ────────────────────────────────────
// Defines which categories each role may count.
// Enforced in: saveCountAction (server action) AND save_inventory_count RPC (DB).
// Used by UI to show/hide "Count Stock" and "Count This Category" buttons.

export const CATEGORY_COUNT_PERMISSIONS: Record<string, string[]> = {
  owner:      ['Fresh', 'Sauces', 'Dry Goods', 'Drinks', 'Packaging', 'Supplies'],
  manager:    ['Fresh', 'Sauces', 'Dry Goods', 'Drinks', 'Packaging', 'Supplies'],
  kitchen:    ['Fresh', 'Sauces', 'Dry Goods', 'Packaging', 'Supplies'],
  front_desk: ['Drinks', 'Packaging'],
}

export function canCountCategory(role: string, category: string): boolean {
  return (CATEGORY_COUNT_PERMISSIONS[role] ?? []).includes(category)
}

// owner and manager can create, edit, and archive inventory items.
// kitchen and front_desk are count-only.
export function canManageInventory(role: string): boolean {
  return role === 'owner' || role === 'manager'
}
