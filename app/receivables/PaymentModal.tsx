'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import MoneyInput from '@/app/components/MoneyInput'
import { recordReceivablePaymentAction } from './actions'
import { SheetActionFooter } from '@/components/ui/SheetActionFooter'

const Z = 2147483647
const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-400 bg-white'
const METHODS = ['Cash', 'Bank Transfer', 'Card', 'Online', 'Other']

export default function PaymentModal({
  receivableId,
  maxAmount,
  onClose,
  onPaid,
}: {
  receivableId: number
  maxAmount: number
  onClose: () => void
  onPaid: () => void
}) {
  const [amountValue, setAmountValue] = useState(0)
  const [method, setMethod] = useState('Cash')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!amountValue || amountValue <= 0) { setError('Enter a valid amount.'); return }
    if (amountValue > maxAmount) { setError(`Amount cannot exceed RM ${maxAmount.toFixed(2)}.`); return }
    setSaving(true)
    setError(null)
    const res = await recordReceivablePaymentAction(receivableId, { amount: amountValue, method, notes: notes.trim() || undefined })
    setSaving(false)
    if (!res.ok) { setError(res.error); return }
    onPaid()
  }

  const content = (
    <div
      className="fixed inset-0 flex flex-col justify-end bg-black/45"
      style={{ zIndex: Z }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl flex flex-col overflow-hidden max-h-[85dvh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Grabber */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 shrink-0">
          <span className="font-semibold text-base">Record Payment</span>
          <button type="button" onClick={onClose} className="text-sm text-gray-400 px-2 py-1">Cancel</button>
        </div>

        {/* Form body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-2">
          {error && (
            <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>
          )}
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Amount (RM) *</label>
              <MoneyInput
                value={amountValue}
                onChange={v => setAmountValue(v ?? 0)}
                max="cash"
                className={inputCls}
                style={{ fontSize: 16 }}
                placeholder={`max ${maxAmount.toFixed(2)}`}
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Method</label>
              <select className={inputCls} style={{ fontSize: 16 }} value={method} onChange={e => setMethod(e.target.value)}>
                {METHODS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Notes</label>
              <input className={inputCls} style={{ fontSize: 16 }} placeholder="Optional" value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Footer — keyboard-aware */}
        <SheetActionFooter className="border-t border-gray-100">
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={onClose}
              className="py-3 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600 active:opacity-80">
              Cancel
            </button>
            <button type="button" onClick={handleSave} disabled={saving}
              className="py-3 rounded-xl text-sm font-semibold text-white active:opacity-90"
              style={{ background: saving ? '#d1d5db' : '#22c55e' }}>
              {saving ? 'Saving…' : 'Record'}
            </button>
          </div>
        </SheetActionFooter>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(content, document.body)
}
