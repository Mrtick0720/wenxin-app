// ── Purchase Service Layer ──
// Business logic for purchase workflow.
// Kitchen/Front Desk submit requests without prices.
// Manager/Owner approve and confirm prices.

import {
  createPurchaseRequest,
  updatePurchaseRequest,
  findPurchaseRequestById,
  findPurchaseRequestsByDate,
  findPurchaseRequestsByStatus,
  addPurchaseItem,
  updatePurchaseItem,
  findRequestItems,
  findConfirmedPurchaseTotal,
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
} from './validation'
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
  if (!request) throw new Error('Purchase request not found.')
  if (request.requestedBy !== staffUserId) {
    throw new Error('You can only submit your own requests.')
  }
  if (!isValidStatusTransition(request.status, 'submitted')) {
    throw new Error(`Cannot submit a request with status "${request.status}".`)
  }

  const items = await findRequestItems(requestId)
  if (items.length === 0) {
    throw new Error('Add at least one item before submitting.')
  }

  return updatePurchaseRequest(requestId, { status: 'submitted' })
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
    throw new Error('Only Manager or Owner can approve purchase requests.')
  }

  const request = await findPurchaseRequestById(requestId)
  if (!request) throw new Error('Purchase request not found.')
  if (!isValidStatusTransition(request.status, 'approved')) {
    throw new Error(`Cannot approve a request with status "${request.status}".`)
  }

  return updatePurchaseRequest(requestId, {
    status: 'approved',
    approvedBy: staffUserId,
    approvedAt: new Date().toISOString(),
  })
}

export async function rejectRequest(
  requestId: number,
  staffUserId: string,
  staffRole: string,
  reason: string,
): Promise<PurchaseRequest> {
  if (!canSetPrices(staffRole)) {
    throw new Error('Only Manager or Owner can reject purchase requests.')
  }
  if (!isValidRejectionReason(reason)) {
    throw new Error('A rejection reason is required.')
  }

  const request = await findPurchaseRequestById(requestId)
  if (!request) throw new Error('Purchase request not found.')
  if (!isValidStatusTransition(request.status, 'rejected')) {
    throw new Error(`Cannot reject a request with status "${request.status}".`)
  }

  return updatePurchaseRequest(requestId, {
    status: 'rejected',
    rejectionReason: reason.trim(),
  })
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
    throw new Error('Only Manager or Owner can confirm prices.')
  }

  const request = await findPurchaseRequestById(requestId)
  if (!request) throw new Error('Purchase request not found.')
  if (!isValidStatusTransition(request.status, 'confirmed')) {
    throw new Error(`Cannot confirm prices for a request with status "${request.status}".`)
  }

  for (const item of items) {
    if (!isValidPrice(item.unitPrice)) {
      throw new Error(`Invalid unit price for item ${item.itemId}.`)
    }
    if (!isValidPrice(item.totalPrice)) {
      throw new Error(`Invalid total price for item ${item.itemId}.`)
    }
  }

  for (const item of items) {
    await updatePurchaseItem(item.itemId, {
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
    })
  }

  return updatePurchaseRequest(requestId, {
    status: 'confirmed',
    confirmedBy: staffUserId,
    confirmedAt: new Date().toISOString(),
  })
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
    throw new Error('Only Manager or Owner can mark as purchased.')
  }

  const request = await findPurchaseRequestById(requestId)
  if (!request) throw new Error('Purchase request not found.')
  if (!isValidStatusTransition(request.status, 'purchased')) {
    throw new Error(`Cannot mark as purchased with status "${request.status}".`)
  }

  return updatePurchaseRequest(requestId, { status: 'purchased' })
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
  if (!request) throw new Error('Purchase request not found.')

  const isOwner = request.requestedBy === staffUserId || canSetPrices(staffRole)
  if (!isOwner) {
    throw new Error('You can only cancel your own requests.')
  }
  if (!isValidStatusTransition(request.status, 'cancelled')) {
    throw new Error(`Cannot cancel a request with status "${request.status}".`)
  }

  return updatePurchaseRequest(requestId, { status: 'cancelled' })
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
