// lib/cashDrawer/types.ts

export type CashDrawerSession = {
  id: number
  businessDate: string        // YYYY-MM-DD
  counter: string
  outletId: string
  outletName: string | null
  cashierOnDutyStaffId: string | null
  cashierOnDutyName: string | null      // resolved from staff_profiles
  openTime: string | null     // ISO timestamptz
  closeTime: string | null
  openedBy: string | null
  closedBy: string | null
  openingFloat: number | null
  closingFloat: number | null
  cashSales: number | null
  payIn: number | null
  payOut: number | null
  alipay: number | null
  duitnow: number | null
  maybankQr: number | null
  touchngo: number | null
  wechat: number | null
  source: 'manual_import' | 'feedme_relay'
  importedAt: string | null
  importedBy: string | null
  createdAt: string
}

export type CashAdjustmentType =
  | 'coupon' | 'voucher' | 'refund'
  | 'manual_adjustment' | 'pay_out' | 'other'

export type CashAdjustment = {
  id: number
  businessDate: string
  outletId: string
  sessionId: number | null
  adjustmentType: CashAdjustmentType
  amount: number
  quantity: number | null
  referenceNo: string | null
  receiptUrl: string | null
  category: string | null
  note: string | null
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected'
  approvedBy: string | null
  approvedAt: string | null
  createdBy: string
  createdAt: string
  deletedAt: string | null
  deletedBy: string | null
}

export type ImportSessionInput = {
  businessDate: string        // YYYY-MM-DD
  counter: string
  cashierOnDutyStaffId?: string | null
  outletName: string | null
  openTime: string | null     // ISO datetime string (from datetime-local input)
  closeTime: string | null
  openedBy: string | null
  closedBy: string | null
  openingFloat: number | null
  closingFloat: number | null
  cashSales: number | null
  payIn: number | null
  payOut: number | null
  alipay: number | null
  duitnow: number | null
  maybankQr: number | null
  touchngo: number | null
  wechat: number | null
}

export type CreateAdjustmentInput = {
  businessDate: string
  sessionId: number | null
  adjustmentType: CashAdjustmentType
  amount: number
  quantity: number | null
  referenceNo: string | null
  category: string | null
  note: string | null
}
