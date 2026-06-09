// ── Assets Validation ──
// Pure validation functions.

import type { AssetStatus, AssetCategory, WarrantyStatus } from './types'

export const VALID_CATEGORIES: AssetCategory[] = [
  'pos', 'printer', 'kitchen_equipment', 'refrigeration',
  'networking', 'furniture', 'other',
]

export const VALID_STATUSES: AssetStatus[] = [
  'active', 'under_repair', 'retired', 'disposed',
]

const STATUS_TRANSITIONS: Record<AssetStatus, AssetStatus[]> = {
  active:        ['under_repair', 'retired', 'disposed'],
  under_repair:  ['active', 'retired', 'disposed'],
  retired:       ['active', 'disposed'],
  disposed:      [],  // terminal
}

export function isValidAssetCode(code: string): boolean {
  return code.trim().length > 0
}

export function isValidAssetName(name: string): boolean {
  return name.trim().length > 0
}

export function isValidCategory(category: string): boolean {
  return VALID_CATEGORIES.includes(category as AssetCategory)
}

export function isValidStatus(status: string): boolean {
  return VALID_STATUSES.includes(status as AssetStatus)
}

export function isValidStatusTransition(from: AssetStatus, to: AssetStatus): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false
}

export function isTerminalStatus(status: AssetStatus): boolean {
  return status === 'disposed'
}

export function isValidDisposalReason(reason: string | null | undefined): boolean {
  return typeof reason === 'string' && reason.trim().length > 0
}

/**
 * Derive warranty status from expiry date. Never stored.
 */
export function getWarrantyStatus(
  warrantyExpiry: string | null,
  today?: Date,
): WarrantyStatus | null {
  if (!warrantyExpiry) return null
  const expiry = new Date(warrantyExpiry)
  const now = today ?? new Date()
  const thirtyDaysFromNow = new Date(now)
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

  if (expiry < now) return 'expired'
  if (expiry <= thirtyDaysFromNow) return 'expiring_soon'
  return 'active'
}

export function isValidPurchaseDate(date: string | null): boolean {
  if (!date) return true  // nullable
  const d = new Date(date)
  return !isNaN(d.getTime()) && d <= new Date()
}

export function isValidWarrantyExpiry(date: string | null, purchaseDate?: string | null): boolean {
  if (!date) return true  // nullable
  const d = new Date(date)
  if (isNaN(d.getTime())) return false
  if (purchaseDate) {
    const pd = new Date(purchaseDate)
    return d >= pd  // warranty must be on or after purchase date
  }
  return true
}
