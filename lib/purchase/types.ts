// ── Purchase Domain Types ──
// Kitchen/Front Desk submit requests without prices.
// Manager/Owner approve and confirm prices.

export type PurchaseRequestStatus =
  | 'draft' | 'submitted' | 'approved' | 'rejected'
  | 'confirmed' | 'purchased' | 'cancelled'

export type Urgency = 'low' | 'normal' | 'high' | 'urgent'

export type PurchaseRequest = {
  id: number
  outletId: string
  businessDate: string
  status: PurchaseRequestStatus
  urgency: Urgency
  requestedBy: string
  approvedBy: string | null
  approvedAt: string | null
  confirmedBy: string | null
  confirmedAt: string | null
  rejectionReason: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type PurchaseRequestItem = {
  id: number
  requestId: number
  itemName: string
  quantity: number
  unit: string
  reason: string | null
  urgency: Urgency
  notes: string | null
  supplierId: number | null
  unitPrice: number | null       // set by Manager/Owner only
  totalPrice: number | null      // computed or set by Manager/Owner
  createdAt: string
  updatedAt: string
}

export type PurchaseAction =
  | 'view_own'
  | 'view_all'
  | 'create_request'
  | 'submit_request'
  | 'approve_request'
  | 'reject_request'
  | 'confirm_prices'
  | 'mark_purchased'
  | 'cancel_request'
