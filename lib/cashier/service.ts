// ── Cashier Service Layer ──
// Business logic for cashier operations.
// Phase 4: Full shift workflow + transactions + sales amount for KPI.

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
  insertTransaction,
  findTransactionsByShift,
  getTodaySalesAmount as getSalesAmountByDateRepo,
  getSalesAmountByDateRange as getSalesAmountByDateRangeRepo,
} from './repository'
import {
  validateShiftStatus,
  calculateCashDifference,
  isValidAdjustmentAmount,
  isValidReason,
  isClosable,
  isVerifiable,
  isReopenable,
  isAdjustable,
  isDifferentUser,
  isValidPaymentMethod,
  isValidTransactionAmount,
  isValidTransactionCount,
  shiftAllowsTransactions,
} from './validation'
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

const DEFAULT_OUTLET_ID = '00000000-0000-0000-0000-000000000001'

// ═══════════════════════════════════════════════════════════════════
// Shift Management
// ═══════════════════════════════════════════════════════════════════

export async function openShift(
  staffUserId: string,
  openingBalance: number,
  businessDate?: string,
): Promise<CashierShift> {
  // Validate: no active OPEN shift exists for the outlet
  const existing = await findActiveShift(DEFAULT_OUTLET_ID)
  if (existing) {
    throw new Error('An open shift already exists. Close the current shift before opening a new one.')
  }

  // Validate: opening float must be non-negative
  if (openingBalance < 0) {
    throw new Error('Opening balance cannot be negative.')
  }

  const today = businessDate ?? new Date().toISOString().split('T')[0]

  return insertShift({
    outletId: DEFAULT_OUTLET_ID,
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
    verifiedByStaffUserId: null,
    verifiedAt: null,
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

  // Validate: shift must be OPEN
  if (!isClosable(shift.status)) {
    throw new Error(`Cannot close a shift with status "${shift.status}". Shift must be open.`)
  }

  // Validate: closing count cannot be negative
  if (actualCashCount < 0) {
    throw new Error('Cash count cannot be negative.')
  }

  // Calculate expected cash: opening + pay_ins - pay_outs
  const adjustments = await findAdjustmentsByShift(shiftId)
  const payIns = adjustments
    .filter(a => a.type === 'pay_in')
    .reduce((sum, a) => sum + a.amount, 0)
  const payOuts = adjustments
    .filter(a => a.type === 'pay_out')
    .reduce((sum, a) => sum + a.amount, 0)

  // Expected total: opening + cash transactions + pay_ins - pay_outs
  const txns = await findTransactionsByShift(shiftId)
  const cashPayments = txns
    .filter(t => t.paymentMethod === 'cash')
    .reduce((sum, t) => sum + t.amount, 0)
  const expectedTotal = shift.openingBalance + cashPayments + payIns - payOuts

  return updateShift(shiftId, {
    status: 'closed',
    closedAt: new Date().toISOString(),
    closedByStaffUserId,
    expectedCashTotal: expectedTotal,
    actualCashCount,
    notes: notes ?? shift.notes,
  })
}

export async function verifyShift(
  shiftId: number,
  verifiedByStaffUserId: string,
): Promise<CashierShift> {
  const shift = await findShiftById(shiftId)
  if (!shift) {
    throw new Error('Shift not found.')
  }

  // Validate: shift must be CLOSED
  if (!isVerifiable(shift.status)) {
    throw new Error(`Cannot verify a shift with status "${shift.status}". Shift must be closed first.`)
  }

  // Validate: verifier must not equal closer
  if (!isDifferentUser(shift.closedByStaffUserId ?? '', verifiedByStaffUserId)) {
    throw new Error('The person who closed the shift cannot verify it. A different staff member must verify.')
  }

  return updateShift(shiftId, {
    status: 'verified',
    verifiedByStaffUserId,
    verifiedAt: new Date().toISOString(),
  })
}

export async function reopenShift(
  shiftId: number,
  reason: string,
  reopenedByStaffUserId: string,
): Promise<CashierShift> {
  const shift = await findShiftById(shiftId)
  if (!shift) {
    throw new Error('Shift not found.')
  }

  // Validate: VERIFIED shifts cannot be reopened
  if (shift.status === 'verified') {
    throw new Error('Verified shifts cannot be reopened.')
  }

  // Validate: only CLOSED shifts may be reopened
  if (!isReopenable(shift.status)) {
    throw new Error(`Cannot reopen a shift with status "${shift.status}". Only closed shifts can be reopened.`)
  }

  // Validate: reason required
  if (!isValidReason(reason)) {
    throw new Error('A reason is required to reopen a shift.')
  }

  // Reopen: reset closing fields, keep the shift open
  return updateShift(shiftId, {
    status: 'open',
    closedAt: null,
    closedByStaffUserId: null,
    actualCashCount: 0,
    notes: shift.notes
      ? `${shift.notes}\nReopened by ${reopenedByStaffUserId}: ${reason.trim()}`
      : `Reopened: ${reason.trim()}`,
  })
}

export async function getActiveShift(): Promise<CashierShift | null> {
  return findActiveShift(DEFAULT_OUTLET_ID)
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

  const transactions = await findTransactionsByShift(shiftId)

  const paymentBreakdown: Record<string, number> = {
    cash: 0,
    touch_n_go: 0,
    alipay: 0,
    card: 0,
    other: 0,
  }
  for (const t of transactions) {
    paymentBreakdown[t.paymentMethod] = (paymentBreakdown[t.paymentMethod] ?? 0) + t.amount
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

// ═══════════════════════════════════════════════════════════════════
// Transactions (Phase 4)
// ═══════════════════════════════════════════════════════════════════

export async function recordPayment(
  shiftId: number,
  paymentMethod: string,
  amount: number,
  transactionCount: number,
  staffUserId: string,
  source?: string,
): Promise<CashierTransaction> {
  if (!isValidPaymentMethod(paymentMethod)) {
    throw new Error(`Invalid payment method: "${paymentMethod}".`)
  }
  if (!isValidTransactionAmount(amount)) {
    throw new Error('Amount must be greater than zero.')
  }
  if (!isValidTransactionCount(transactionCount)) {
    throw new Error('Transaction count cannot be negative.')
  }

  const shift = await findShiftById(shiftId)
  if (!shift) throw new Error('Shift not found.')
  if (!shiftAllowsTransactions(shift.status)) {
    throw new Error(`Cannot record payments on a shift with status "${shift.status}".`)
  }

  const today = new Date().toISOString().split('T')[0]
  return insertTransaction({
    shiftId,
    businessDate: today,
    paymentMethod,
    amount,
    transactionCount,
    source: source ?? 'manual',
    createdBy: staffUserId,
  })
}

export async function getShiftTransactions(
  shiftId: number,
): Promise<CashierTransaction[]> {
  return findTransactionsByShift(shiftId)
}

/**
 * Get today's total sales amount.
 * This is the denominator for Purchase-to-Sales Ratio KPI.
 */
export async function getTodaySalesAmount(
  businessDate?: string,
): Promise<number> {
  const today = businessDate ?? new Date().toISOString().split('T')[0]
  return getSalesAmountByDate(today)
}

export async function getSalesAmountByDate(
  businessDate: string,
): Promise<number> {
  return getSalesAmountByDateRepo(businessDate)
}

export async function getSalesAmountByDateRange(
  fromDate: string,
  toDate: string,
): Promise<number> {
  return getSalesAmountByDateRangeRepo(fromDate, toDate)
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

  // Validate: shift must be OPEN
  if (!isAdjustable(shift.status)) {
    throw new Error(`Cannot record adjustments on a shift with status "${shift.status}". Shift must be open.`)
  }

  // Validate: amount > 0
  if (!isValidAdjustmentAmount(amount)) {
    throw new Error('Adjustment amount must be greater than zero.')
  }

  // Validate: reason required
  if (!isValidReason(reason)) {
    throw new Error('A reason is required for all adjustments.')
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

// ── Validation re-exports ──
// Pure functions live in validation.ts for testability.
// Re-exported here for backward compatibility.

export {
  validateShiftStatus,
  calculateCashDifference,
  isWithinAllowedDifference,
  isValidAmount,
  isValidAdjustmentAmount,
  isValidReason,
  isClosable,
  isVerifiable,
  isReopenable,
  isAdjustable,
  isDifferentUser,
  isValidPaymentMethod,
  isValidTransactionAmount,
  isValidTransactionCount,
  shiftAllowsTransactions,
} from './validation'
