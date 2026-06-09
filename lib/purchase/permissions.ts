// ── Purchase Permission Integration ──
// Uses the new Permission Layer (Phase 0) for Purchase module access control.

import { hasPermission, hasAllPermissions } from '@/lib/auth/permissionCheck'
import { PERMISSION, type PermissionKey } from '@/lib/auth/permissionKeys'
import type { StaffRole } from '@/lib/auth/types'
import type { PurchaseAction } from './types'

const ACTION_PERMISSION_MAP: Record<PurchaseAction, PermissionKey[]> = {
  view_own:        [PERMISSION.VIEW_PURCHASE],
  view_all:        [PERMISSION.VIEW_PURCHASE],
  create_request:  [PERMISSION.VIEW_PURCHASE, PERMISSION.EDIT_PURCHASE],
  submit_request:  [PERMISSION.VIEW_PURCHASE, PERMISSION.EDIT_PURCHASE],
  approve_request: [PERMISSION.VIEW_PURCHASE, PERMISSION.APPROVE_PURCHASE],
  reject_request:  [PERMISSION.VIEW_PURCHASE, PERMISSION.APPROVE_PURCHASE],
  confirm_prices:  [PERMISSION.VIEW_PURCHASE, PERMISSION.APPROVE_PURCHASE],
  mark_purchased:  [PERMISSION.VIEW_PURCHASE, PERMISSION.APPROVE_PURCHASE],
  cancel_request:  [PERMISSION.VIEW_PURCHASE, PERMISSION.EDIT_PURCHASE],
}

export function canPerformPurchaseAction(role: StaffRole, action: PurchaseAction): boolean {
  const required = ACTION_PERMISSION_MAP[action]
  if (!required) return false
  return hasAllPermissions(role, required)
}

export function canViewPurchase(role: StaffRole): boolean {
  return hasPermission(role, PERMISSION.VIEW_PURCHASE)
}

export function canEditPurchase(role: StaffRole): boolean {
  return hasPermission(role, PERMISSION.EDIT_PURCHASE)
}

export function canApprovePurchase(role: StaffRole): boolean {
  return hasPermission(role, PERMISSION.APPROVE_PURCHASE)
}

export function getPurchaseActionsForRole(role: StaffRole): PurchaseAction[] {
  return (Object.keys(ACTION_PERMISSION_MAP) as PurchaseAction[]).filter(action =>
    canPerformPurchaseAction(role, action)
  )
}
