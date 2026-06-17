// ── Purchase Ledger Validation ──
// Pure validation. No Supabase, no side effects.

export function isValidItemName(name: string | null | undefined): boolean {
  return typeof name === 'string' && name.trim().length > 0
}

export function isValidQuantity(quantity: number): boolean {
  return Number.isFinite(quantity) && quantity > 0
}

export function isValidUnit(unit: string | null | undefined): boolean {
  return typeof unit === 'string' && unit.trim().length > 0
}

export function isValidCategory(category: string | null | undefined): boolean {
  return typeof category === 'string' && category.trim().length > 0
}

/** Price is optional; when present it must be a finite, non-negative number. */
export function isValidPrice(price: number | null | undefined): boolean {
  if (price === null || price === undefined) return true
  return Number.isFinite(price) && price >= 0
}

/** Round to 2 decimals, guarding floating-point drift (e.g. 2.3 * 14). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** Compute line total from quantity and unit price, when a price is given. */
export function computeTotal(
  quantity: number,
  unitPrice: number | null | undefined,
): number | null {
  if (unitPrice === null || unitPrice === undefined) return null
  return round2(quantity * unitPrice)
}
