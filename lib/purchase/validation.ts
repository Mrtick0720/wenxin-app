// ── Purchase Validation ──
// Pure validation functions. No Supabase, no database, no side effects.

import type { PurchaseRequestStatus, Urgency } from './types'

/**
 * Valid urgency values.
 */
export const VALID_URGENCY: Urgency[] = ['low', 'normal', 'high', 'urgent']

/**
 * Validate item name is non-empty.
 */
export function isValidItemName(name: string): boolean {
  return name.trim().length > 0
}

/**
 * Validate quantity is greater than zero.
 */
export function isValidQuantity(quantity: number): boolean {
  return quantity > 0
}

/**
 * Validate unit is non-empty.
 */
export function isValidUnit(unit: string): boolean {
  return unit.trim().length > 0
}

/**
 * Validate urgency is a valid value.
 */
export function isValidUrgency(urgency: string): boolean {
  return VALID_URGENCY.includes(urgency as Urgency)
}

/**
 * Validate a price is non-negative (for Manager/Owner price setting).
 */
export function isValidPrice(price: number | null | undefined): boolean {
  if (price === null || price === undefined) return true  // nullable is OK
  return price >= 0
}

/**
 * Validate a rejection reason is non-empty.
 */
export function isValidRejectionReason(reason: string | null | undefined): boolean {
  return typeof reason === 'string' && reason.trim().length > 0
}

/**
 * Status transition rules.
 */
const STATUS_TRANSITIONS: Record<PurchaseRequestStatus, PurchaseRequestStatus[]> = {
  draft:      ['submitted', 'cancelled'],
  submitted:  ['approved', 'rejected'],
  approved:   ['confirmed', 'cancelled'],
  rejected:   ['draft'],           // can edit and resubmit
  confirmed:  ['purchased', 'cancelled'],
  purchased:  [],                  // terminal
  cancelled:  [],                  // terminal
}

/**
 * Check if a status transition is valid.
 */
export function isValidStatusTransition(
  from: PurchaseRequestStatus,
  to: PurchaseRequestStatus,
): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false
}

/**
 * Check if a user role can set prices on a request.
 * Only Manager and Owner can set prices.
 */
export function canSetPrices(role: string): boolean {
  return role === 'owner' || role === 'manager'
}

/**
 * Check if a user role can only submit requests (no prices).
 * Kitchen and Front Desk cannot set prices.
 */
export function isPriceRestrictedRole(role: string): boolean {
  return !canSetPrices(role)
}
