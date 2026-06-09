// ── Purchase Lifecycle — Typed Errors (Phase 2.1) ──
// Stable error catalogue for purchaseLifecycleService transitions.

import type { PurchaseLifecycleErrorCode } from './types'

export class PurchaseLifecycleError extends Error {
  readonly code: PurchaseLifecycleErrorCode
  constructor(code: PurchaseLifecycleErrorCode, message: string) {
    super(message)
    this.name = 'PurchaseLifecycleError'
    this.code = code
  }
}

export const InvalidTransitionError = (from: string, to: string) =>
  new PurchaseLifecycleError('PR_INVALID_TRANSITION', `Illegal transition: "${from}" → "${to}".`)

export const ReservedTransitionError = (to: string) =>
  new PurchaseLifecycleError('PR_RESERVED', `Status "${to}" is reserved for a later phase.`)

export const NotPricedError = () =>
  new PurchaseLifecycleError('PR_NOT_PRICED', 'All line items must be priced before confirming.')

export const ApprovalLimitExceededError = (total: number, limit: number) =>
  new PurchaseLifecycleError(
    'PR_LIMIT_EXCEEDED',
    `Total ${total} exceeds the Manager approval limit ${limit}; Owner confirmation required.`,
  )

export const SelfApprovalForbiddenError = () =>
  new PurchaseLifecycleError('PR_SELF_APPROVAL', 'You cannot approve or reject your own request.')

export const RejectionReasonRequiredError = () =>
  new PurchaseLifecycleError('PR_REASON_REQUIRED', 'A rejection reason is required.')

export const RequestNotFoundError = (requestId: number) =>
  new PurchaseLifecycleError('PR_NOT_FOUND', `Purchase request ${requestId} not found.`)

export const PermissionDeniedError = (msg = 'Insufficient permission for this action.') =>
  new PurchaseLifecycleError('PR_FORBIDDEN', msg)

export const ConcurrentModificationError = () =>
  new PurchaseLifecycleError('PR_CONFLICT', 'Request status changed concurrently; reload and retry.')
