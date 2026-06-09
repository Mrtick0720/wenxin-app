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
