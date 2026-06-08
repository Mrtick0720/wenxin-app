// ── Cashier Repository Layer ──
// Data access for cashier operations. Abstracts Supabase queries.
// Phase 1: Stub implementations. Real queries come with database migrations.

import type {
  CashierShift,
  CashierTransaction,
  CashierAdjustment,
  CashierSettings,
  PaymentMethod,
} from './types'

// ── Shifts ──

export async function insertShift(
  _shift: Omit<CashierShift, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<CashierShift> {
  throw new Error('Not yet implemented — database migration required')
}

export async function updateShift(
  _shiftId: number,
  _updates: Partial<CashierShift>,
): Promise<CashierShift> {
  throw new Error('Not yet implemented — database migration required')
}

export async function findActiveShift(
  _outletId: string,
): Promise<CashierShift | null> {
  throw new Error('Not yet implemented — database migration required')
}

export async function findShiftById(
  _shiftId: number,
): Promise<CashierShift | null> {
  throw new Error('Not yet implemented — database migration required')
}

export async function findShiftsByDate(
  _businessDate: string,
  _outletId: string,
): Promise<CashierShift[]> {
  throw new Error('Not yet implemented — database migration required')
}

// ── Transactions ──

export async function insertTransaction(
  _transaction: Omit<CashierTransaction, 'id' | 'createdAt'>,
): Promise<CashierTransaction> {
  throw new Error('Not yet implemented — database migration required')
}

export async function findTransactionsByShift(
  _shiftId: number,
): Promise<CashierTransaction[]> {
  throw new Error('Not yet implemented — database migration required')
}

// ── Adjustments ──

export async function insertAdjustment(
  _adjustment: Omit<CashierAdjustment, 'id' | 'createdAt'>,
): Promise<CashierAdjustment> {
  throw new Error('Not yet implemented — database migration required')
}

export async function findAdjustmentsByShift(
  _shiftId: number,
): Promise<CashierAdjustment[]> {
  throw new Error('Not yet implemented — database migration required')
}

// ── Payment Methods ──

export async function findPaymentMethods(
  _outletId: string,
): Promise<PaymentMethod[]> {
  throw new Error('Not yet implemented — database migration required')
}

export async function findActivePaymentMethods(
  _outletId: string,
): Promise<PaymentMethod[]> {
  throw new Error('Not yet implemented — database migration required')
}

// ── Settings ──

export async function findSettings(
  _outletId: string,
): Promise<CashierSettings | null> {
  throw new Error('Not yet implemented — database migration required')
}

export async function upsertSettings(
  _settings: CashierSettings,
): Promise<CashierSettings> {
  throw new Error('Not yet implemented — database migration required')
}
