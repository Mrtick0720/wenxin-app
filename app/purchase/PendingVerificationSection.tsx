'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { PurchaseRecord } from '@/lib/purchaseLedger/types'
import { categoryColor } from '@/lib/purchaseLedger/categories'
import { acceptVerificationAction, rejectVerificationAction, cancelPurchaseAction } from './verification-actions'

const Z_MAX = 2147483647

export type PendingVerificationItem = PurchaseRecord

type Props = {
  items: PendingVerificationItem[]
  canVerify: boolean
  onAccepted: (record: PurchaseRecord) => void
  onAcceptFailed: (id: number) => void
  onRejected: (id: number) => void
  onRejectFailed: (id: number) => void
  onCancelled: (id: number) => void
  onCancelFailed: (id: number) => void
}

function fmtQty(n: number, unit: string): string {
  const s = n % 1 === 0 ? String(n) : n.toFixed(3).replace(/\.?0+$/, '')
  return `${s} ${unit}`
}

// ── Verification bottom sheet (tap row to open) ──────────────────────────────

type SheetProps = {
  item: PendingVerificationItem
  canVerify: boolean
  onAccept: (receivedQty: number) => Promise<void>
  onReject: (reason: string) => Promise<void>
  onCancel: () => Promise<void>
  onClose: () => void
}

function VerificationSheet({ item, canVerify, onAccept, onReject, onCancel, onClose }: SheetProps) {
  const [receivedQty, setReceivedQty] = useState(String(item.quantity))
  const [rejectReason, setRejectReason] = useState('')
  const [mode, setMode] = useState<'main' | 'reject'>('main')
  const [accepting, setAccepting] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const parsedQty = parseFloat(receivedQty) || item.quantity
  const diff = parsedQty - item.quantity
  const hasDiff = Math.abs(diff) > 0.001

  async function handleAccept() {
    setAccepting(true)
    await onAccept(parsedQty)
    setAccepting(false)
  }

  async function handleRejectConfirm() {
    setRejecting(true)
    await onReject(rejectReason)
    setRejecting(false)
  }

  async function handleCancel() {
    setCancelling(true)
    await onCancel()
    setCancelling(false)
  }

  const content = (
    <div
      className="fixed flex flex-col justify-end"
      style={{ top: 0, left: 0, right: 0, bottom: 0, zIndex: Z_MAX, background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl flex flex-col px-4 pt-5"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 24px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          {mode === 'reject' ? (
            <button type="button" onClick={() => setMode('main')} className="text-blue-500 text-sm active:opacity-70">
              ← Back
            </button>
          ) : <div />}
          <span className="font-semibold text-base text-gray-900">
            {mode === 'reject' ? `Reject — ${item.name}` : item.name}
          </span>
          <button type="button" onClick={onClose} className="text-gray-400 text-2xl leading-none active:opacity-70">×</button>
        </div>

        {mode === 'main' ? (
          <>
            {/* Info */}
            <div className="text-sm text-gray-500 mb-4">
              Purchased {fmtQty(item.quantity, item.unit)}
              {item.purchased_by_name ? ` · ${item.purchased_by_name}` : ''}
            </div>

            {/* Received qty */}
            {canVerify && (
              <div className="mb-4">
                <label className="text-xs text-gray-400 mb-1 block">Received quantity</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    className="w-28 border border-gray-200 rounded-xl px-3 py-2.5 text-center outline-none focus:border-orange-400"
                    style={{ fontSize: 16 }}
                    value={receivedQty}
                    onChange={e => setReceivedQty(e.target.value)}
                  />
                  <span className="text-sm text-gray-500">{item.unit}</span>
                </div>
                {hasDiff && (
                  <div className="mt-1.5 text-xs" style={{ color: diff < 0 ? '#ef4444' : '#22c55e' }}>
                    Difference: {diff > 0 ? '+' : ''}{diff.toFixed(3).replace(/\.?0+$/, '')} {item.unit}
                  </div>
                )}
              </div>
            )}

            {/* Buttons */}
            {canVerify && (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={cancelling || accepting}
                  onClick={handleCancel}
                  className="w-full py-3 rounded-2xl border border-gray-200 text-sm font-medium text-gray-500 active:opacity-70 flex items-center justify-center gap-1.5"
                >
                  <span style={{ fontSize: 15 }}>↩</span>
                  {cancelling ? 'Returning…' : 'Return to To Buy'}
                </button>
              </div>
            )}

            {canVerify && (
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setMode('reject')}
                  className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-medium text-gray-700 active:opacity-70"
                >
                  Reject
                </button>
                <button
                  type="button"
                  disabled={accepting}
                  onClick={handleAccept}
                  className="flex-1 py-3 rounded-2xl text-sm font-semibold text-white active:opacity-80"
                  style={{ background: accepting ? '#9ca3af' : '#1d4ed8' }}
                >
                  {accepting ? 'Saving…' : 'Accept'}
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <label className="text-xs text-gray-400 mb-1 block">Reason (optional)</label>
            <textarea
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-red-400 bg-white resize-none"
              style={{ fontSize: 16, minHeight: 80 }}
              placeholder="e.g. wrong quantity, not delivered, quality issue…"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              autoFocus
            />
            <button
              type="button"
              disabled={rejecting}
              onClick={handleRejectConfirm}
              className="mt-4 w-full py-3 rounded-2xl text-sm font-semibold text-white active:opacity-80"
              style={{ background: rejecting ? '#9ca3af' : '#ef4444' }}
            >
              {rejecting ? 'Rejecting…' : 'Confirm Reject'}
            </button>
          </>
        )}
      </div>
    </div>
  )

  return createPortal(content, document.body)
}

// ── Compact row (mirrors ChecklistSection style) ─────────────────────────────

type RowProps = {
  item: PendingVerificationItem
  isFirst: boolean
  isLast: boolean
  onTap: () => void
}

function PendingRow({ item, isFirst, isLast, onTap }: RowProps) {
  const clr = categoryColor(item.category)
  const borderBottom = !isLast ? '1px solid #f3f4f6' : 'none'
  const stripRadius = {
    borderTopLeftRadius: isFirst ? 20 : 0,
    borderBottomLeftRadius: isLast ? 20 : 0,
  }

  return (
    <div style={{ position: 'relative', borderBottom, background: '#fff' }}>
      {/* Category color bar */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: clr, zIndex: 2, pointerEvents: 'none', ...stripRadius }} />
      <button
        type="button"
        onClick={onTap}
        className="w-full flex items-center gap-3 px-4 py-3 active:opacity-70 text-left"
      >
        {/* Clock icon — same size as checklist checkbox (24×24) */}
        <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        {/* Name — matches checklist: font-semibold 16px */}
        <span className="flex-1 font-semibold text-gray-900 truncate" style={{ fontSize: 16 }}>
          {item.name}
        </span>
        {/* Qty — matches checklist: font-medium 13px */}
        <span className="font-medium text-gray-500 tabular-nums whitespace-nowrap" style={{ fontSize: 13 }}>
          {fmtQty(item.quantity, item.unit)}
        </span>
        {/* Purchaser — matches checklist creator column */}
        {item.purchased_by_name && (
          <span className="font-medium text-gray-500 truncate text-right" style={{ fontSize: 13, maxWidth: 64 }}>
            {item.purchased_by_name}
          </span>
        )}
        {/* Chevron */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
    </div>
  )
}

// ── Section ──────────────────────────────────────────────────────────────────

export default function PendingVerificationSection({ items, canVerify, onAccepted, onAcceptFailed, onRejected, onRejectFailed, onCancelled, onCancelFailed }: Props) {
  const [activeItem, setActiveItem] = useState<PendingVerificationItem | null>(null)

  async function handleAccept(receivedQty: number) {
    if (!activeItem) return
    const id = activeItem.id
    setActiveItem(null)
    const res = await acceptVerificationAction(id, receivedQty)
    if (res.ok) onAccepted(res.data)
    else onAcceptFailed(id)
  }

  async function handleReject(reason: string) {
    if (!activeItem) return
    const id = activeItem.id
    setActiveItem(null)
    const res = await rejectVerificationAction(id, reason)
    if (res.ok) onRejected(id)
    else onRejectFailed(id)
  }

  async function handleCancel() {
    if (!activeItem) return
    const id = activeItem.id
    setActiveItem(null)
    const res = await cancelPurchaseAction(id)
    if (res.ok) onCancelled(id)
    else onCancelFailed(id)
  }

  if (items.length === 0) return null

  return (
    <div className="mx-4 mt-4">
      <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
        {items.map((item, i) => (
          <PendingRow
            key={item.id}
            item={item}
            isFirst={i === 0}
            isLast={i === items.length - 1}
            onTap={() => setActiveItem(item)}
          />
        ))}
      </div>

      {activeItem && (
        <VerificationSheet
          item={activeItem}
          canVerify={canVerify}
          onAccept={handleAccept}
          onReject={handleReject}
          onCancel={handleCancel}
          onClose={() => setActiveItem(null)}
        />
      )}
    </div>
  )
}
