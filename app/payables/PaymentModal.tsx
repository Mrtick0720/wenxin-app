'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { markPurchasePaidAction } from './actions'
import { SheetActionFooter } from '@/components/ui/SheetActionFooter'

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
      className="fixed inset-0 flex flex-col justify-end bg-black/45"
      style={{ zIndex: Z }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Grabber */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Body */}
        <div className="px-5 pt-3 pb-4 shrink-0">
          <div className="text-base font-semibold mb-2">Mark Paid</div>
          <div className="text-sm text-gray-500">
            Mark the full amount{' '}
            <span className="font-semibold text-gray-900">{fmt(amount)}</span>{' '}
            as paid?
          </div>
          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <SheetActionFooter className="border-t border-gray-100">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onClose}
              className="py-3 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600 active:opacity-80"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="py-3 rounded-xl text-sm font-semibold text-white active:opacity-90"
              style={{ background: saving ? '#d1d5db' : '#22c55e' }}
            >
              {saving ? 'Saving…' : 'Mark Paid'}
            </button>
          </div>
        </SheetActionFooter>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(content, document.body)
}
