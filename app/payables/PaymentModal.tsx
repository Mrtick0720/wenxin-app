'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { markPurchasePaidAction } from './actions'

const Z = 2147483647

function fmt(amount: number) {
  return `RM ${amount.toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export default function PaymentModal({
  payableId,
  amount,
  onClose,
  onPaid,
}: {
  payableId: number
  amount: number
  onClose: () => void
  onPaid: (id: number) => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    const res = await markPurchasePaidAction(payableId)
    setSaving(false)

    if (!res.ok) {
      setError(res.error)
      return
    }
    onPaid(res.data.id)
  }

  const content = (
    <div
      className="fixed flex items-center justify-center"
      style={{ inset: 0, zIndex: Z, background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="mx-5 w-full max-w-sm rounded-2xl bg-white p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-2 text-base font-semibold">Mark Paid</div>
        <div className="text-sm text-gray-500">
          Mark the full amount <span className="font-semibold text-gray-900">{fmt(amount)}</span> as paid?
        </div>
        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl bg-gray-100 py-2.5 text-sm font-semibold text-gray-600 active:opacity-80"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white active:opacity-90"
            style={{ background: saving ? '#d1d5db' : '#22c55e' }}
          >
            {saving ? 'Saving…' : 'Mark Paid'}
          </button>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(content, document.body)
}
