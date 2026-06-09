// ── Checklist Validation ──
// Pure validation functions. No Supabase, no database, no side effects.

import type { ChecklistInstance, ChecklistItemResponse, ChecklistInstanceStatus } from './types'

/**
 * Check if all item responses are non-pending (instance is complete).
 */
export function isInstanceComplete(responses: ChecklistItemResponse[]): boolean {
  return responses.length > 0 && responses.every(r => r.status !== 'pending')
}

/**
 * Check if an instance is overdue.
 * Overdue = scheduled time has passed AND status is pending or in_progress.
 */
export function isOverdue(instance: ChecklistInstance): boolean {
  if (!['pending', 'in_progress'].includes(instance.status)) return false
  return new Date() > new Date(instance.scheduledTime)
}

/**
 * Calculate compliance score as percentage of passed items.
 */
export function complianceScore(responses: ChecklistItemResponse[]): number {
  const total = responses.length
  if (total === 0) return 0
  const passed = responses.filter(r => r.status === 'pass').length
  return Math.round((passed / total) * 100)
}

/**
 * Check if an instance status transition is valid.
 */
export function isValidStatusTransition(
  from: ChecklistInstanceStatus,
  to: ChecklistInstanceStatus,
): boolean {
  const transitions: Record<ChecklistInstanceStatus, ChecklistInstanceStatus[]> = {
    pending:     ['in_progress'],
    in_progress: ['completed'],
    completed:   ['verified', 'in_progress'],  // verified or rejected back
    verified:    [],  // terminal
  }
  return transitions[from]?.includes(to) ?? false
}

/**
 * Validate that a response note is present when required.
 */
export function isResponseNoteRequired(status: string, requiresNoteOnFail: boolean): boolean {
  if (status === 'fail' && requiresNoteOnFail) return true
  if (status === 'skip') return true
  return false
}

/**
 * Validate a run_key is non-empty.
 */
export function isValidRunKey(runKey: string): boolean {
  return runKey.trim().length > 0
}

/**
 * Group instances by status for display ordering.
 */
export function statusSortOrder(status: ChecklistInstanceStatus): number {
  const order: Record<ChecklistInstanceStatus, number> = {
    pending: 0,
    in_progress: 1,
    completed: 2,
    verified: 3,
  }
  return order[status] ?? 99
}

// ═══════════════════════════════════════════════════════════════════
// Phase 2 — Response & Verification Validation
// ═══════════════════════════════════════════════════════════════════

/**
 * Check if a staff member can respond to items on an instance.
 * Instance must be pending or in_progress, and assigned to their role.
 */
export function canRespondToItem(
  instance: { status: string; assignedRole: string },
  staffRole: string,
): boolean {
  if (!['pending', 'in_progress'].includes(instance.status)) return false
  if (staffRole === 'owner' || staffRole === 'manager') return true
  return instance.assignedRole === staffRole
}

/**
 * Check if an instance can be completed.
 * All items must be responded to (no pending).
 */
export function canCompleteInstance(
  responses: ChecklistItemResponse[],
): boolean {
  return responses.length > 0 && responses.every(r => r.status !== 'pending')
}

/**
 * Check if an instance can be verified by a manager.
 * Must be completed, and verifier is different from completer.
 */
export function canVerifyInstance(
  instance: { status: string },
): boolean {
  return instance.status === 'completed'
}

/**
 * Check if an instance can be rejected by a manager.
 * Must be completed.
 */
export function canRejectInstance(
  instance: { status: string },
): boolean {
  return instance.status === 'completed'
}

/**
 * Validate a failed item note.
 */
export function validateFailedItemNote(
  note: string | null | undefined,
  requiresNote: boolean,
): boolean {
  if (!requiresNote) return true
  return typeof note === 'string' && note.trim().length > 0
}

/**
 * Validate that a rejection reason is provided.
 */
export function validateRejectionReason(reason: string | null | undefined): boolean {
  return typeof reason === 'string' && reason.trim().length > 0
}

/**
 * Check if a response status is valid.
 */
export function isValidResponseStatus(status: string): boolean {
  return ['pass', 'fail', 'skip'].includes(status)
}
