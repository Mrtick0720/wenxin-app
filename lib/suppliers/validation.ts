// ── Suppliers Validation ──
// Pure validation functions.

import type { SupplierStatus, PaymentTerms } from './types'

export const VALID_STATUSES: SupplierStatus[] = ['active', 'inactive', 'suspended']

export const VALID_PAYMENT_TERMS: PaymentTerms[] = [
  'cod', 'net_7', 'net_14', 'net_30', 'net_60',
]

export function isValidCompanyName(name: string): boolean {
  return name.trim().length > 0
}

export function isValidStatus(status: string): boolean {
  return VALID_STATUSES.includes(status as SupplierStatus)
}

export function isValidPaymentTerms(terms: string | null | undefined): boolean {
  if (terms === null || terms === undefined) return true  // nullable
  if (terms.trim().length === 0) return false  // empty string is not valid
  return VALID_PAYMENT_TERMS.includes(terms as PaymentTerms)
}

export function isValidContactName(name: string): boolean {
  return name.trim().length > 0
}

/**
 * Check if a status transition is valid.
 */
const STATUS_TRANSITIONS: Record<SupplierStatus, SupplierStatus[]> = {
  active:    ['inactive', 'suspended'],
  inactive:  ['active', 'suspended'],
  suspended: ['active', 'inactive'],
}

export function isValidStatusTransition(
  from: SupplierStatus,
  to: SupplierStatus,
): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false
}
