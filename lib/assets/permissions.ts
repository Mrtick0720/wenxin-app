// ── Assets Permission Integration ──
// Uses the new Permission Layer (Phase 0).

import { hasPermission, hasAllPermissions } from '@/lib/auth/permissionCheck'
import { PERMISSION, type PermissionKey } from '@/lib/auth/permissionKeys'
import type { StaffRole } from '@/lib/auth/types'
import type { AssetAction } from './types'

const ACTION_PERMISSION_MAP: Record<AssetAction, PermissionKey[]> = {
  view_assets:    [PERMISSION.VIEW_ASSETS],
  edit_assets:    [PERMISSION.VIEW_ASSETS, PERMISSION.EDIT_ASSETS],
  dispose_assets: [PERMISSION.VIEW_ASSETS, PERMISSION.EDIT_ASSETS],
}

export function canPerformAssetAction(role: StaffRole, action: AssetAction): boolean {
  const required = ACTION_PERMISSION_MAP[action]
  if (!required) return false
  return hasAllPermissions(role, required)
}

export function canViewAssets(role: StaffRole): boolean {
  return hasPermission(role, PERMISSION.VIEW_ASSETS)
}

export function canEditAssets(role: StaffRole): boolean {
  return hasPermission(role, PERMISSION.EDIT_ASSETS)
}

export function getAssetActionsForRole(role: StaffRole): AssetAction[] {
  return (Object.keys(ACTION_PERMISSION_MAP) as AssetAction[]).filter(action =>
    canPerformAssetAction(role, action)
  )
}
