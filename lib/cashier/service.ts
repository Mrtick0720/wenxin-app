// ── Cashier Service Layer ──
// Business logic for cashier operations.
// Phase 2: Real logic for shifts, payment methods, and adjustments.
// Transactions and settings remain stubs pending future phases.

import {
  insertShift,
  updateShift,
  findActiveShift,
  findShiftById,
  findShiftsByDate,
  insertAdjustment,
  findAdjustmentsByShift,
  findPaymentMethods,
  findActivePaymentMethods,
} from './repository'
import type {
  CashierShift,
  CashierShiftSummary,
  CashierTransaction,
  CashierAdjustment,
  CashierSettings,
  CashierShiftStatus,
  AdjustmentType,
  PaymentMethod,
} from './types'

// ═══════════════════════════════════════════════════════════════════
// Shift Management
// ═══════════════════════════════════════════════════════════════════

export async function openShift(
  staffUserId: string,
  openingBalance: number,
  businessDate?: string,
): Promise<CashierShift> {
  // One open shift per outlet — check for existing
  const existing = await findActiveShift()
  if (existing) {
    throw new Error('An open shift already exists. Close the current shift before opening a new one.')
  }

  const today = businessDate ?? new Date().toISOString().split('T')[0]

  return insertShift({
    outletId: '00000000-0000-0000-0000-000000000001',
    staffUserId,
    businessDate: today,
    openedAt: new Date().toISOString(),
    closedAt: null,
    status: 'open',
    openingBalance,
    expectedCashTotal: openingBalance,
    actualCashCount: 0,
    notes: null,
    closedByStaffUserId: null,
    auditedByStaffUserId: null,
    auditedAt: null,
  })
}

export async function closeShift(
  shiftId: number,
  actualCashCount: number,
  notes: string | null,
  closedByStaffUserId: string,
): Promise<CashierShift> {
  const shift = await findShiftById(shiftId)
  if (!shift) {
    throw new Error('Shift not found.')
  }
  if (!validateShiftStatus(shift.status, ['open', 'closing'])) {
    throw new Error(`Cannot close a shift with status "${shift.status}".`)
  }

  // Calculate expected cash: opening + cash payments + pay_ins - pay_outs
  const adjustments = await findAdjustmentsByShift(shiftId)
  const payIns = adjustments
    .filter(a => a.type === 'pay_in')
    .reduce((sum, a) => sum + a.amount, 0)
  const payOuts = adjustments
    .filter(a => a.type === 'pay_out')
    .reduce((sum, a) => sum + a.amount, 0)

  // Transactions not yet implemented — expected total is approximate
  const expectedTotal = shift.openingBalance + payIns - payOuts
  const difference = calculateCashDifference(expectedTotal, actualCashCount)

  return updateShift(shiftId, {
    status: 'closed',
    closedAt: new Date().toISOString(),
    closedByStaffUserId,
    expectedCashTotal: expectedTotal,
    actualCashCount,
    notes: notes ?? shift.notes,
  })
}

export async function getActiveShift(): Promise<CashierShift | null> {
  return findActiveShift()
}

export async function getShiftById(
  shiftId: number,
): Promise<CashierShift | null> {
  return findShiftById(shiftId)
}

export async function getShiftsByDate(
  businessDate: string,
): Promise<CashierShift[]> {
  return findShiftsByDate(businessDate)
}

export async function getShiftSummary(
  shiftId: number,
): Promise<CashierShiftSummary | null> {
  const shift = await findShiftById(shiftId)
  if (!shift) return null

  const adjustments = await findAdjustmentsByShift(shiftId)

  // Transactions not yet implemented — empty array
  const transactions: CashierTransaction[] = []

  const paymentBreakdown: Record<string, number> = {
    cash: 0,
    card: 0,
    ewallet: 0,
    transfer: 0,
    other: 0,
  }

  const totalPayments = transactions.reduce((sum, t) => sum + t.amount, 0)
  const totalAdjustments = adjustments.reduce((sum, a) => {
    return sum + (a.type === 'pay_out' ? -a.amount : a.amount)
  }, 0)
  const netCash = shift.openingBalance + paymentBreakdown.cash + totalAdjustments

  return {
    shift,
    transactions,
    adjustments,
    paymentBreakdown,
    totalPayments,
    totalAdjustments,
    netCash,
  }
}

export async function auditShift(
  shiftId: number,
  auditedByStaffUserId: string,
): Promise<CashierShift> {
  const shift = await findShiftById(shiftId)
  if (!shift) {
    throw new Error('Shift not found.')
  }
  if (!validateShiftStatus(shift.status, ['closed'])) {
    throw new Error(`Cannot audit a shift with status "${shift.status}". Shift must be closed first.`)
  }

  return updateShift(shiftId, {
    status: 'audited',
    auditedByStaffUserId,
    auditedAt: new Date().toISOString(),
  })
}

// ═══════════════════════════════════════════════════════════════════
// Transactions — Stubs (pending future phase)
// ═══════════════════════════════════════════════════════════════════

export async function recordPayment(
  _shiftId: number,
  _paymentMethodId: number,
  _amount: number,
  _reference: string | null,
  _note: string | null,
): Promise<CashierTransaction> {
  throw new Error('Not yet implemented — cashier_transactions table pending')
}

export async function getShiftTransactions(
  _shiftId: number,
): Promise<CashierTransaction[]> {
  throw new Error('Not yet implemented — cashier_transactions table pending')
}

// ═══════════════════════════════════════════════════════════════════
// Adjustments
// ═══════════════════════════════════════════════════════════════════

export async function recordAdjustment(
  shiftId: number,
  type: AdjustmentType,
  amount: number,
  reason: string,
  authorizedByStaffUserId: string,
): Promise<CashierAdjustment> {
  const shift = await findShiftById(shiftId)
  if (!shift) {
    throw new Error('Shift not found.')
  }
  if (!validateShiftStatus(shift.status, ['open'])) {
    throw new Error(`Cannot record adjustments on a shift with status "${shift.status}". Shift must be open.`)
  }
  if (!reason.trim()) {
    throw new Error('A reason is required for all adjustments.')
  }
  if (amount <= 0) {
    throw new Error('Adjustment amount must be greater than zero.')
  }

  return insertAdjustment({
    shiftId,
    type,
    amount,
    reason: reason.trim(),
    authorizedByStaffUserId,
  })
}

export async function getShiftAdjustments(
  shiftId: number,
): Promise<CashierAdjustment[]> {
  return findAdjustmentsByShift(shiftId)
}

// ═══════════════════════════════════════════════════════════════════
// Payment Methods
// ═══════════════════════════════════════════════════════════════════

export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  return findPaymentMethods()
}

export async function getActivePaymentMethods(): Promise<PaymentMethod[]> {
  return findActivePaymentMethods()
}

// ═══════════════════════════════════════════════════════════════════
// Settings — Stubs (pending future phase)
// ═══════════════════════════════════════════════════════════════════

export async function getCashierSettings(
  _outletId: string,
): Promise<CashierSettings | null> {
  throw new Error('Not yet implemented — cashier_settings pending')
}

export async function updateCashierSettings(
  _outletId: string,
  _settings: Partial<CashierSettings>,
): Promise<CashierSettings> {
  throw new Error('Not yet implemented — cashier_settings pending')
}

// ═══════════════════════════════════════════════════════════════════
// Validation
// ═══════════════════════════════════════════════════════════════════

export function validateShiftStatus(
  status: CashierShiftStatus,
  allowedStatuses: CashierShiftStatus[],
): boolean {
  return allowedStatuses.includes(status)
}

export function calculateCashDifference(
  expectedTotal: number,
  actualCount: number,
): number {
  return actualCount - expectedTotal
}

export function isWithinAllowedDifference(
  difference: number,
  maxDifference: number,
): boolean {
  return Math.abs(difference) <= maxDifference
}
