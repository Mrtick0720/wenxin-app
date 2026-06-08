// ── Cashier Validation ──
// Pure validation functions. No Supabase, no database, no side effects.
// Importable by both service.ts (server) and test scripts (any environment).

import type { CashierShiftStatus } from './types'

/**
 * Check if a shift status is in the allowed set.
 */
export function validateShiftStatus(
  status: CashierShiftStatus,
  allowedStatuses: CashierShiftStatus[],
): boolean {
  return allowedStatuses.includes(status)
}

/**
 * Calculate the difference between actual cash count and expected total.
 * Positive = over, negative = short.
 */
export function calculateCashDifference(
  expectedTotal: number,
  actualCount: number,
): number {
  return actualCount - expectedTotal
}

/**
 * Check if a cash difference is within the allowed threshold.
 */
export function isWithinAllowedDifference(
  difference: number,
  maxDifference: number,
): boolean {
  return Math.abs(difference) <= maxDifference
}

/**
 * Validate a monetary amount is non-negative.
 */
export function isValidAmount(amount: number): boolean {
  return amount >= 0
}

/**
 * Validate an adjustment amount is positive.
 */
export function isValidAdjustmentAmount(amount: number): boolean {
  return amount > 0
}

/**
 * Validate a reason string is non-empty after trimming.
 */
export function isValidReason(reason: string | null | undefined): boolean {
  return typeof reason === 'string' && reason.trim().length > 0
}

/**
 * Check if a shift status allows closing.
 */
export function isClosable(status: CashierShiftStatus): boolean {
  return status === 'open'
}

/**
 * Check if a shift status allows verification.
 */
export function isVerifiable(status: CashierShiftStatus): boolean {
  return status === 'closed'
}

/**
 * Check if a shift status allows reopening.
 */
export function isReopenable(status: CashierShiftStatus): boolean {
  return status === 'closed'
}

/**
 * Check if a shift status allows adjustments.
 */
export function isAdjustable(status: CashierShiftStatus): boolean {
  return status === 'open'
}

/**
 * Check if two user IDs are different (verifier must not equal closer).
 */
export function isDifferentUser(userIdA: string, userIdB: string): boolean {
  return userIdA !== userIdB
}
