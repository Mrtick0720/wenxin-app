// ── Purchase Ledger Service ──
// Business logic + permission enforcement for the procurement ledger. The
// server actions and the page server component call into here. Costs are only
// ever requested from the repository for roles that may view them.

import 'server-only'

import type { StaffRole } from '@/lib/auth/types'
import {
  canAddPurchase,
  canDeletePurchase,
  canEditRecord,
  canViewMonthTotal,
  canViewPurchaseCosts,
  historyWindowDays,
} from './permissions'
import { businessToday, monthStart, shiftDays } from './time'
import {
  isValidCategory,
  isValidItemName,
  isValidPrice,
  isValidQuantity,
  isValidUnit,
  computeTotal,
} from './validation'
import {
  deleteRecordRow,
  getRecordById,
  insertRecord,
  queryRecords,
  updateRecordRow,
} from './repository'
import { sortCategories } from './categories'
import type {
  CategoryTotal,
  PurchaseFilters,
  PurchaseRecord,
  PurchaseRecordInput,
  PurchaseSummary,
} from './types'

/** Earliest date a role may see (inclusive). null = no lower bound (owner). */
function windowFrom(role: StaffRole, today: string): string | null {
  const days = historyWindowDays(role)
  if (days === null) return null
  return shiftDays(today, -(days - 1))
}

/** List records for a role, clamped to the role's allowed history window. */
export async function listRecords(
  role: StaffRole,
  filters: PurchaseFilters = {},
): Promise<PurchaseRecord[]> {
  const today = businessToday()
  const lower = windowFrom(role, today)

  // A user filter cannot widen the window beyond what the role allows.
  let from = filters.from
  if (lower && (!from || from < lower)) from = lower

  return queryRecords({
    withCosts: canViewPurchaseCosts(role),
    from,
    to: filters.to,
    filters: { category: filters.category, supplier: filters.supplier, purchaser: filters.purchaser },
  })
}

/** Dashboard summary. Returns null for roles that may not view costs (staff). */
export async function getSummary(role: StaffRole): Promise<PurchaseSummary | null> {
  if (!canViewPurchaseCosts(role)) return null

  const today = businessToday()
  const weekFrom = shiftDays(today, -6)
  const showMonth = canViewMonthTotal(role)

  // Fetch the widest window we need to aggregate, within the role's allowance.
  const lower = windowFrom(role, today)
  const candidates = [weekFrom, ...(showMonth ? [monthStart(today)] : [])]
  let from = candidates.reduce((a, b) => (a < b ? a : b))
  if (lower && from < lower) from = lower

  const rows = await queryRecords({ withCosts: true, from })

  const sum = (predicate: (r: PurchaseRecord) => boolean) =>
    rows.filter(predicate).reduce((s, r) => s + (r.total_price ?? 0), 0)

  const today_ = sum((r) => r.date === today)
  const week = sum((r) => r.date >= weekFrom)
  const month = showMonth ? sum((r) => r.date >= monthStart(today)) : null

  // Category breakdown over the role's visible window (manager: 7d, owner: month).
  const breakdownFrom = showMonth ? monthStart(today) : weekFrom
  const totals = new Map<string, number>()
  for (const r of rows) {
    if (r.date < breakdownFrom) continue
    totals.set(r.category, (totals.get(r.category) ?? 0) + (r.total_price ?? 0))
  }
  const categoryBreakdown: CategoryTotal[] = sortCategories([...totals.keys()])
    .map((category) => ({ category, total: totals.get(category) ?? 0 }))
    .filter((c) => c.total > 0)

  return { today: today_, week, month, categoryBreakdown }
}

export async function getRecord(
  role: StaffRole,
  id: number,
): Promise<PurchaseRecord | null> {
  return getRecordById(id, canViewPurchaseCosts(role))
}

function validateInput(input: PurchaseRecordInput): string | null {
  if (!isValidItemName(input.name)) return 'Item name is required.'
  if (!isValidQuantity(input.quantity)) return 'Quantity must be greater than zero.'
  if (!isValidUnit(input.unit)) return 'Unit is required.'
  if (!isValidCategory(input.category)) return 'Category is required.'
  if (!isValidPrice(input.unit_price)) return 'Unit price must be zero or more.'
  return null
}

/** Create a record. Staff (kitchen) are forced to today + no costs/supplier. */
export async function createRecord(
  role: StaffRole,
  staffUserId: string,
  staffName: string,
  input: PurchaseRecordInput,
): Promise<PurchaseRecord> {
  if (!canAddPurchase(role)) throw new Error('You cannot add purchase records.')
  const error = validateInput(input)
  if (error) throw new Error(error)

  const today = businessToday()
  const withCosts = canViewPurchaseCosts(role)

  const row: Record<string, unknown> = {
    date: withCosts ? input.date?.trim() || today : today, // staff: always today
    name: input.name.trim(),
    specification: input.specification?.trim() || null,
    category: input.category,
    unit: input.unit.trim(),
    quantity: input.quantity,
    purchaser: input.purchaser?.trim() || staffName,
    receiver: input.receiver?.trim() || null,
    note: input.remarks?.trim() || null,
    created_by: staffUserId,
    status: 'pending',
  }

  if (withCosts) {
    row.unit_price = input.unit_price ?? null
    row.total_price = computeTotal(input.quantity, input.unit_price)
    row.supplier = input.supplier?.trim() || null
    row.purchase_method = input.purchase_method?.trim() || 'Supplier Delivery'
  } else {
    // Staff records never carry costs or supplier.
    row.unit_price = null
    row.total_price = null
    row.supplier = null
  }

  return insertRecord(row, withCosts)
}

/** Update a record, honouring per-role edit rights and cost restrictions. */
export async function updateRecord(
  role: StaffRole,
  staffUserId: string,
  id: number,
  input: PurchaseRecordInput,
): Promise<PurchaseRecord> {
  if (!canAddPurchase(role)) throw new Error('You cannot edit purchase records.')

  const withCosts = canViewPurchaseCosts(role)
  const existing = await getRecordById(id, withCosts)
  if (!existing) throw new Error('Record not found.')

  const today = businessToday()
  if (!canEditRecord(role, existing, staffUserId, today)) {
    throw new Error('You can only edit records you created today.')
  }

  const error = validateInput(input)
  if (error) throw new Error(error)

  const patch: Record<string, unknown> = {
    name: input.name.trim(),
    specification: input.specification?.trim() || null,
    category: input.category,
    unit: input.unit.trim(),
    quantity: input.quantity,
    purchaser: input.purchaser?.trim() || null,
    receiver: input.receiver?.trim() || null,
    note: input.remarks?.trim() || null,
  }

  if (withCosts) {
    patch.unit_price = input.unit_price ?? null
    patch.total_price = computeTotal(input.quantity, input.unit_price)
    patch.supplier = input.supplier?.trim() || null
    if (input.purchase_method) patch.purchase_method = input.purchase_method.trim()
    if (input.date) patch.date = input.date.trim()
  }
  // Staff: date/costs/supplier are intentionally not patched.

  return updateRecordRow(id, patch, withCosts)
}

export async function deleteRecord(role: StaffRole, id: number): Promise<void> {
  if (!canDeletePurchase(role)) throw new Error('Only the owner can delete records.')
  await deleteRecordRow(id)
}
