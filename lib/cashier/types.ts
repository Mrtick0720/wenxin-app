// ── Cashier Domain Types ──
// Approved entities from the Cashier module architecture.
// Phase 1: Type definitions only. Database tables come later.

// ── Cashier Shift ──
// A cashier work session. Opened at shift start, closed at shift end.
// Tracks expected vs. actual cash totals and all payment activity.

export type CashierShiftStatus = 'open' | 'closing' | 'closed' | 'verified'

export type CashierShift = {
  id: number
  outletId: string
  staffUserId: string
  businessDate: string
  openedAt: string
  closedAt: string | null
  status: CashierShiftStatus
  openingBalance: number        // RM — cash float at shift start
  expectedCashTotal: number     // RM — computed from payments + opening
  actualCashCount: number       // RM — physically counted at closing
  cashDifference: number        // RM — actual minus expected
  notes: string | null
  closedByStaffUserId: string | null
  verifiedByStaffUserId: string | null
  verifiedAt: string | null
  createdAt: string
  updatedAt: string
}

// ── Payment Method ──
// Payment types accepted at the restaurant.

export type PaymentMethodType = 'cash' | 'card' | 'ewallet' | 'transfer' | 'other'

export type PaymentMethod = {
  id: number
  outletId: string
  name: string                   // Display name, e.g. "Touch 'n Go", "Maybank QR"
  type: PaymentMethodType
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

// ── Cashier Transaction ──
// A payment received during a shift. Linked to a shift and a payment method.

export type CashierTransaction = {
  id: number
  shiftId: number
  paymentMethodId: number
  amount: number                 // RM
  reference: string | null       // Order number, bill reference, etc.
  note: string | null
  createdAt: string
}

// ── Cashier Adjustment ──
// A manual adjustment to the till during a shift.
// Used for pay-outs (e.g., taking cash for purchase), pay-ins (e.g., float top-up),
// or corrections.

export type AdjustmentType = 'pay_in' | 'pay_out' | 'correction'

export type CashierAdjustment = {
  id: number
  shiftId: number
  type: AdjustmentType
  amount: number                 // RM — positive for pay_in, negative for pay_out
  reason: string                 // Required — why the adjustment was made
  authorizedByStaffUserId: string
  createdAt: string
}

// ── Shift Summary (Derived) ──
// Computed at query time, not stored.

export type CashierShiftSummary = {
  shift: CashierShift
  transactions: CashierTransaction[]
  adjustments: CashierAdjustment[]
  paymentBreakdown: Record<PaymentMethodType, number>  // total per payment type
  totalPayments: number
  totalAdjustments: number
  netCash: number               // opening + cash payments + pay_ins - pay_outs
}

// ── Cashier Settings ──
// Per-outlet cashier configuration.

export type CashierSettings = {
  outletId: string
  defaultOpeningBalance: number  // RM — default float amount
  requireCashCount: boolean      // Require physical cash count on closing
  maxCashDifference: number      // RM — max allowed difference before flagging
  activePaymentMethods: number[] // IDs of active payment methods
  updatedAt: string
}

// ── Cashier Permissions ──
// Permission checks specific to the Cashier module.

export type CashierAction =
  | 'view_shift'
  | 'open_shift'
  | 'close_shift'
  | 'record_payment'
  | 'make_adjustment'
  | 'verify_shift'
  | 'view_reports'
  | 'manage_settings'
