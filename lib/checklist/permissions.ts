// ── Checklist Permission Integration ──
// Uses the new Permission Layer (Phase 0) for Checklist module access control.

import { hasPermission, hasAllPermissions } from '@/lib/auth/permissionCheck'
import { PERMISSION, type PermissionKey } from '@/lib/auth/permissionKeys'
import type { StaffRole } from '@/lib/auth/types'
import type { ChecklistAction } from './types'

const ACTION_PERMISSION_MAP: Record<ChecklistAction, PermissionKey[]> = {
  view_own:         [PERMISSION.VIEW_CHECKLIST_SELF],
  view_all:         [PERMISSION.VIEW_CHECKLIST_ALL],
  respond:          [PERMISSION.VIEW_CHECKLIST_SELF, PERMISSION.EDIT_CHECKLIST_SELF],
  verify:           [PERMISSION.VIEW_CHECKLIST_ALL, PERMISSION.VERIFY_CHECKLIST],
  manage_templates: [PERMISSION.MANAGE_CHECKLIST_TEMPLATES],
}

export function canPerformChecklistAction(role: StaffRole, action: ChecklistAction): boolean {
  const required = ACTION_PERMISSION_MAP[action]
  if (!required) return false
  return hasAllPermissions(role, required)
}

export function canViewChecklist(role: StaffRole): boolean {
  return hasPermission(role, PERMISSION.VIEW_CHECKLIST_SELF)
}

export function canViewAllChecklists(role: StaffRole): boolean {
  return hasPermission(role, PERMISSION.VIEW_CHECKLIST_ALL)
}

export function canRespondToChecklist(role: StaffRole): boolean {
  return hasPermission(role, PERMISSION.EDIT_CHECKLIST_SELF)
}

export function canVerifyChecklist(role: StaffRole): boolean {
  return hasPermission(role, PERMISSION.VERIFY_CHECKLIST)
}

export function canManageTemplates(role: StaffRole): boolean {
  return hasPermission(role, PERMISSION.MANAGE_CHECKLIST_TEMPLATES)
}

export function getChecklistActionsForRole(role: StaffRole): ChecklistAction[] {
  return (Object.keys(ACTION_PERMISSION_MAP) as ChecklistAction[]).filter(action =>
    canPerformChecklistAction(role, action)
  )
}
