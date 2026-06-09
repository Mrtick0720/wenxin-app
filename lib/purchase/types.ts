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
  rejectedBy: string | null
  rejectedAt: string | null
  cancelledBy: string | null
  cancelledAt: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

// ── Phase 2.1 Lifecycle Hardening ──

/** Approval tier required at a given request value. */
export type ApprovalTier = 'manager' | 'owner'

/** Approval configuration (sourced from restaurant_settings). */
export type ApprovalSettings = {
  managerLimit: number
  allowSelfApprove: boolean
}

/** Stable lifecycle error codes (see lifecycleErrors.ts). */
export type PurchaseLifecycleErrorCode =
  | 'PR_INVALID_TRANSITION'
  | 'PR_RESERVED'
  | 'PR_NOT_PRICED'
  | 'PR_LIMIT_EXCEEDED'
  | 'PR_SELF_APPROVAL'
  | 'PR_REASON_REQUIRED'
  | 'PR_NOT_FOUND'
  | 'PR_FORBIDDEN'
  | 'PR_CONFLICT'

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
