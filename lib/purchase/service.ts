// ── Purchase Service Layer ──
// Business logic for purchase workflow.
// Kitchen/Front Desk submit requests without prices.
// Manager/Owner approve and confirm prices.

import {
  createPurchaseRequest,
  findPurchaseRequestById,
  findPurchaseRequestsByDate,
  findPurchaseRequestsByStatus,
  addPurchaseItem,
  updatePurchaseItem,
  findRequestItems,
  findConfirmedPurchaseTotal,
  transitionRequestStatus,
  getApprovalSettings,
} from './repository'
import {
  isValidItemName,
  isValidQuantity,
  isValidUnit,
  isValidUrgency,
  isValidPrice,
  isValidRejectionReason,
  isValidStatusTransition,
  canSetPrices,
  approvalTierFor,
  meetsApprovalTier,
  isSelfApproval,
} from './validation'
import {
  InvalidTransitionError,
  NotPricedError,
  ApprovalLimitExceededError,
  SelfApprovalForbiddenError,
  RejectionReasonRequiredError,
  RequestNotFoundError,
  PermissionDeniedError,
  ConcurrentModificationError,
} from './lifecycleErrors'
import type { PurchaseRequest, PurchaseRequestItem } from './types'

// ═══════════════════════════════════════════════════════════════════
// Create & Submit (Staff — no prices)
// ═══════════════════════════════════════════════════════════════════

export async function createRequest(
  staffUserId: string,
  urgency: string,
  notes?: string | null,
): Promise<PurchaseRequest> {
  if (!isValidUrgency(urgency)) {
    throw new Error(`Invalid urgency: "${urgency}".`)
  }
  const today = new Date().toISOString().split('T')[0]
  return createPurchaseRequest({
    businessDate: today,
    urgency,
    requestedBy: staffUserId,
    notes,
  })
}

export async function addItem(
  requestId: number,
  staffUserId: string,
  staffRole: string,
  item: {
    itemName: string
    quantity: number
    unit: string
    reason?: string | null
    urgency?: string
    notes?: string | null
    supplierId?: number | null
  },
): Promise<PurchaseRequestItem> {
  const request = await findPurchaseRequestById(requestId)
  if (!request) throw new Error('Purchase request not found.')
  if (request.status !== 'draft' && request.status !== 'rejected') {
    throw new Error('Items can only be added to draft or rejected requests.')
  }
  if (request.requestedBy !== staffUserId && !canSetPrices(staffRole)) {
    throw new Error('You can only add items to your own requests.')
  }

  if (!isValidItemName(item.itemName)) {
    throw new Error('Item name is required.')
  }
  if (!isValidQuantity(item.quantity)) {
    throw new Error('Quantity must be greater than zero.')
  }
  if (!isValidUnit(item.unit)) {
    throw new Error('Unit is required.')
  }
  if (item.urgency && !isValidUrgency(item.urgency)) {
    throw new Error(`Invalid urgency: "${item.urgency}".`)
  }

  return addPurchaseItem({
    requestId,
    itemName: item.itemName.trim(),
    quantity: item.quantity,
    unit: item.unit.trim(),
    reason: item.reason ?? null,
    urgency: item.urgency ?? request.urgency,
    notes: item.notes ?? null,
    supplierId: item.supplierId ?? null,
  })
}

export async function submitRequest(
  requestId: number,
  staffUserId: string,
): Promise<PurchaseRequest> {
  const request = await findPurchaseRequestById(requestId)
  if (!request) throw RequestNotFoundError(requestId)
  if (request.requestedBy !== staffUserId) {
    throw PermissionDeniedError('You can only submit your own requests.')
  }
  if (!isValidStatusTransition(request.status, 'submitted')) {
    throw InvalidTransitionError(request.status, 'submitted')
  }

  const items = await findRequestItems(requestId)
  if (items.length === 0) {
    throw new Error('Add at least one item before submitting.')
  }

  const updated = await transitionRequestStatus(requestId, request.status, { status: 'submitted' })
  if (!updated) throw ConcurrentModificationError()
  return updated
}

// ═══════════════════════════════════════════════════════════════════
// Approve & Reject (Manager/Owner)
// ═══════════════════════════════════════════════════════════════════

export async function approveRequest(
  requestId: number,
  staffUserId: string,
  staffRole: string,
): Promise<PurchaseRequest> {
  if (!canSetPrices(staffRole)) {
    throw PermissionDeniedError('Only Manager or Owner can approve purchase requests.')
  }

  const request = await findPurchaseRequestById(requestId)
  if (!request) throw RequestNotFoundError(requestId)
  if (!isValidStatusTransition(request.status, 'approved')) {
    throw InvalidTransitionError(request.status, 'approved')
  }

  // Segregation of duties: requester cannot approve own request (unless configured).
  const { allowSelfApprove } = await getApprovalSettings()
  if (!allowSelfApprove && isSelfApproval(request.requestedBy, staffUserId)) {
    throw SelfApprovalForbiddenError()
  }

  const updated = await transitionRequestStatus(requestId, request.status, {
    status: 'approved',
    approvedBy: staffUserId,
    approvedAt: new Date().toISOString(),
  })
  if (!updated) throw ConcurrentModificationError()
  return updated
}

export async function rejectRequest(
  requestId: number,
  staffUserId: string,
  staffRole: string,
  reason: string,
): Promise<PurchaseRequest> {
  if (!canSetPrices(staffRole)) {
    throw PermissionDeniedError('Only Manager or Owner can reject purchase requests.')
  }
  if (!isValidRejectionReason(reason)) {
    throw RejectionReasonRequiredError()
  }

  const request = await findPurchaseRequestById(requestId)
  if (!request) throw RequestNotFoundError(requestId)
  if (!isValidStatusTransition(request.status, 'rejected')) {
    throw InvalidTransitionError(request.status, 'rejected')
  }

  // Segregation of duties: requester cannot reject own request (unless configured).
  const { allowSelfApprove } = await getApprovalSettings()
  if (!allowSelfApprove && isSelfApproval(request.requestedBy, staffUserId)) {
    throw SelfApprovalForbiddenError()
  }

  const updated = await transitionRequestStatus(requestId, request.status, {
    status: 'rejected',
    rejectionReason: reason.trim(),
    rejectedBy: staffUserId,
    rejectedAt: new Date().toISOString(),
  })
  if (!updated) throw ConcurrentModificationError()
  return updated
}

// ═══════════════════════════════════════════════════════════════════
// Confirm Prices (Manager/Owner only)
// ═══════════════════════════════════════════════════════════════════

export async function confirmPrices(
  requestId: number,
  staffUserId: string,
  staffRole: string,
  items: Array<{ itemId: number; unitPrice: number; totalPrice: number }>,
): Promise<PurchaseRequest> {
  if (!canSetPrices(staffRole)) {
    throw PermissionDeniedError('Only Manager or Owner can confirm prices.')
  }

  const request = await findPurchaseRequestById(requestId)
  if (!request) throw RequestNotFoundError(requestId)
  if (!isValidStatusTransition(request.status, 'confirmed')) {
    throw InvalidTransitionError(request.status, 'confirmed')
  }

  for (const item of items) {
    if (!isValidPrice(item.unitPrice)) {
      throw new Error(`Invalid unit price for item ${item.itemId}.`)
    }
    if (!isValidPrice(item.totalPrice)) {
      throw new Error(`Invalid total price for item ${item.itemId}.`)
    }
  }

  // Apply prices first so the spend-commit tier reflects the priced lines.
  for (const item of items) {
    await updatePurchaseItem(item.itemId, {
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
    })
  }

  // Priced precondition: every line of the request must now carry a unit price.
  const allItems = await findRequestItems(requestId)
  if (allItems.length === 0 || allItems.some((i) => i.unitPrice == null)) {
    throw NotPricedError()
  }

  // Tiered spend approval: Manager limited; Owner unlimited.
  const total = allItems.reduce((sum, i) => sum + (i.totalPrice ?? 0), 0)
  const { managerLimit } = await getApprovalSettings()
  const tier = approvalTierFor(total, managerLimit)
  if (!meetsApprovalTier(staffRole, tier)) {
    throw ApprovalLimitExceededError(total, managerLimit)
  }

  const updated = await transitionRequestStatus(requestId, request.status, {
    status: 'confirmed',
    confirmedBy: staffUserId,
    confirmedAt: new Date().toISOString(),
  })
  if (!updated) throw ConcurrentModificationError()
  return updated
}

// ═══════════════════════════════════════════════════════════════════
// Mark Purchased
// ═══════════════════════════════════════════════════════════════════

export async function markPurchased(
  requestId: number,
  staffUserId: string,
  staffRole: string,
): Promise<PurchaseRequest> {
  if (!canSetPrices(staffRole)) {
    throw PermissionDeniedError('Only Manager or Owner can mark as purchased.')
  }

  const request = await findPurchaseRequestById(requestId)
  if (!request) throw RequestNotFoundError(requestId)
  if (!isValidStatusTransition(request.status, 'purchased')) {
    throw InvalidTransitionError(request.status, 'purchased')
  }

  const updated = await transitionRequestStatus(requestId, request.status, { status: 'purchased' })
  if (!updated) throw ConcurrentModificationError()
  return updated
}

// ═══════════════════════════════════════════════════════════════════
// Cancel
// ═══════════════════════════════════════════════════════════════════

export async function cancelRequest(
  requestId: number,
  staffUserId: string,
  staffRole: string,
): Promise<PurchaseRequest> {
  const request = await findPurchaseRequestById(requestId)
  if (!request) throw RequestNotFoundError(requestId)

  const isOwner = request.requestedBy === staffUserId || canSetPrices(staffRole)
  if (!isOwner) {
    throw PermissionDeniedError('You can only cancel your own requests.')
  }
  if (!isValidStatusTransition(request.status, 'cancelled')) {
    throw InvalidTransitionError(request.status, 'cancelled')
  }

  const updated = await transitionRequestStatus(requestId, request.status, {
    status: 'cancelled',
    cancelledBy: staffUserId,
    cancelledAt: new Date().toISOString(),
  })
  if (!updated) throw ConcurrentModificationError()
  return updated
}

// ═══════════════════════════════════════════════════════════════════
// Queries
// ═══════════════════════════════════════════════════════════════════

export async function getRequestById(
  requestId: number,
): Promise<{ request: PurchaseRequest; items: PurchaseRequestItem[] } | null> {
  const request = await findPurchaseRequestById(requestId)
  if (!request) return null
  const items = await findRequestItems(requestId)
  return { request, items }
}

export async function getRequestsByDate(
  businessDate: string,
): Promise<PurchaseRequest[]> {
  return findPurchaseRequestsByDate(businessDate)
}

export async function getPendingApprovals(): Promise<PurchaseRequest[]> {
  return findPurchaseRequestsByStatus('submitted')
}

export async function getConfirmedPurchaseTotal(
  businessDate: string,
): Promise<number> {
  return findConfirmedPurchaseTotal(businessDate)
}

// ═══════════════════════════════════════════════════════════════════
// Re-exports
// ═══════════════════════════════════════════════════════════════════

export {
  isValidItemName,
  isValidQuantity,
  isValidUnit,
  isValidUrgency,
  isValidPrice,
  isValidRejectionReason,
  isValidStatusTransition,
  canSetPrices,
  isPriceRestrictedRole,
} from './validation'
