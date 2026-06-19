'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { recordReceivablePaymentAction } from './actions'

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
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('Cash')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0) { setError('Enter a valid amount.'); return }
    if (parsed > maxAmount) { setError(`Amount cannot exceed RM ${maxAmount.toFixed(2)}.`); return }
    setSaving(true)
    setError(null)
    const res = await recordReceivablePaymentAction(receivableId, { amount: parsed, method, notes: notes.trim() || undefined })
    setSaving(false)
    if (!res.ok) { setError(res.error); return }
    onPaid()
  }

  const content = (
    <div className="fixed flex items-center justify-center"
      style={{ inset: 0, zIndex: Z, background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}>
      <div className="bg-white rounded-2xl mx-5 p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="font-semibold text-base mb-4">Record Payment</div>
        {error && <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>}
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Amount (RM) *</label>
            <input className={inputCls} style={{ fontSize: 16 }} type="number" inputMode="decimal" min="0.01" step="0.01"
              placeholder={`max ${maxAmount.toFixed(2)}`}
              value={amount} onChange={e => setAmount(e.target.value)} />
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
        <div className="flex gap-3 mt-5">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600 active:opacity-80">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white active:opacity-90"
            style={{ background: saving ? '#d1d5db' : '#22c55e' }}>
            {saving ? 'Saving…' : 'Record'}
          </button>
        </div>
      </div>
    </div>
  )
  if (typeof document === 'undefined') return null
  return createPortal(content, document.body)
}
