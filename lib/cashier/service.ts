// ── Cashier Service Layer ──
// Business logic for cashier operations.
// Phase 1: Stub implementations. Real logic comes with database migrations.

import type {
  CashierShift,
  CashierShiftSummary,
  CashierTransaction,
  CashierAdjustment,
  CashierSettings,
  CashierShiftStatus,
  AdjustmentType,
} from './types'

// ── Shift Management ──

export async function openShift(
  _staffUserId: string,
  _openingBalance: number,
): Promise<CashierShift> {
  throw new Error('Not yet implemented — database migration required')
}

export async function closeShift(
  _shiftId: number,
  _actualCashCount: number,
  _notes: string | null,
  _closedByStaffUserId: string,
): Promise<CashierShift> {
  throw new Error('Not yet implemented — database migration required')
}

export async function getActiveShift(
  _outletId: string,
): Promise<CashierShift | null> {
  throw new Error('Not yet implemented — database migration required')
}

export async function getShiftById(
  _shiftId: number,
): Promise<CashierShift | null> {
  throw new Error('Not yet implemented — database migration required')
}

export async function getShiftSummary(
  _shiftId: number,
): Promise<CashierShiftSummary | null> {
  throw new Error('Not yet implemented — database migration required')
}

export async function auditShift(
  _shiftId: number,
  _auditedByStaffUserId: string,
): Promise<CashierShift> {
  throw new Error('Not yet implemented — database migration required')
}

// ── Transactions ──

export async function recordPayment(
  _shiftId: number,
  _paymentMethodId: number,
  _amount: number,
  _reference: string | null,
  _note: string | null,
): Promise<CashierTransaction> {
  throw new Error('Not yet implemented — database migration required')
}

export async function getShiftTransactions(
  _shiftId: number,
): Promise<CashierTransaction[]> {
  throw new Error('Not yet implemented — database migration required')
}

// ── Adjustments ──

export async function recordAdjustment(
  _shiftId: number,
  _type: AdjustmentType,
  _amount: number,
  _reason: string,
  _authorizedByStaffUserId: string,
): Promise<CashierAdjustment> {
  throw new Error('Not yet implemented — database migration required')
}

export async function getShiftAdjustments(
  _shiftId: number,
): Promise<CashierAdjustment[]> {
  throw new Error('Not yet implemented — database migration required')
}

// ── Settings ──

export async function getCashierSettings(
  _outletId: string,
): Promise<CashierSettings | null> {
  throw new Error('Not yet implemented — database migration required')
}

export async function updateCashierSettings(
  _outletId: string,
  _settings: Partial<CashierSettings>,
): Promise<CashierSettings> {
  throw new Error('Not yet implemented — database migration required')
}

// ── Validation ──

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
