'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import MoneyInput from '@/app/components/MoneyInput'
import { createCashAdjustmentAction } from './actions'
import { SheetActionFooter } from '@/components/ui/SheetActionFooter'

type Tab = 'coupon' | 'pay_out'

type Props = {
  isOpen: boolean
  businessDate: string
  sessionId: number | null
  onClose: () => void
  onSaved: () => void
}

export default function AddAdjustmentSheet({ isOpen, businessDate, sessionId, onClose, onSaved }: Props) {
  const [mounted, setMounted] = useState(false)
  const [tab, setTab] = useState<Tab>('coupon')
  const [amountValue, setAmountValue] = useState(0)
  const [quantity, setQuantity] = useState('')
  const [referenceNo, setReferenceNo] = useState('')
  const [category, setCategory] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (isOpen) {
      setTab('coupon')
      setAmountValue(0)
      setQuantity('')
      setReferenceNo('')
      setCategory('')
      setNote('')
      setError(null)
    }
  }, [isOpen])

  async function handleSubmit() {
    if (submitting) return
    if (!amountValue || amountValue <= 0) {
      setError('Amount must be greater than zero')
      return
    }
    setSubmitting(true)
    setError(null)

    const result = await createCashAdjustmentAction({
      businessDate,
      sessionId,
      adjustmentType: tab,
      amount:         amountValue,
      quantity:       tab === 'coupon' && quantity.trim() ? parseInt(quantity.trim(), 10) : null,
      referenceNo:    tab === 'coupon' && referenceNo.trim() ? referenceNo.trim() : null,
      category:       tab === 'pay_out' && category.trim() ? category.trim() : null,
      note:           note.trim() || null,
    })

    if (result.ok) {
      onSaved()
      onClose()
    } else {
      setError(result.error)
      setSubmitting(false)
    }
  }

  if (!mounted || !isOpen) return null

  const inputClass = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400'
  const labelClass = 'block text-xs text-gray-500 mb-1'

  const tabDescriptions: Record<Tab, string> = {
    coupon:  'Record a coupon or discount applied during this session.',
    pay_out: 'Record cash taken out of the drawer for a purchase or expense.',
  }

  const content = (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl overflow-hidden max-h-[90dvh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0">
          <span className="font-semibold text-base">Add Adjustment</span>
          <button onClick={onClose} className="text-sm text-gray-400 px-2 py-1">Cancel</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-4 pb-3 shrink-0">
          {(['coupon', 'pay_out'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(null) }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                tab === t ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {t === 'coupon' ? 'Coupon' : 'Pay Out'}
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-4 pb-2">
          {/* Tab description */}
          <p className="text-xs text-gray-400 mb-4">{tabDescriptions[tab]}</p>

          {/* Business date (read-only context) */}
          <div className="text-xs text-gray-400 mb-4">
            Date: <span className="font-medium text-gray-600">{businessDate}</span>
          </div>

          {/* Amount — required */}
          <div className="mb-4">
            <label className={labelClass}>Amount (RM) <span className="text-red-400">*</span></label>
            <MoneyInput
              value={amountValue}
              onChange={v => { setAmountValue(v ?? 0); setError(null) }}
              max="cash"
              className={inputClass}
              style={{ fontSize: 14 }}
            />
          </div>

          {/* Coupon-specific fields */}
          {tab === 'coupon' && (
            <>
              <div className="mb-4">
                <label className={labelClass}>
                  No. of Coupons <span className="text-gray-300">(optional)</span>
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="e.g. 2"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="mb-4">
                <label className={labelClass}>
                  Coupon / Batch No. <span className="text-gray-300">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. DISC2026-001"
                  value={referenceNo}
                  onChange={e => setReferenceNo(e.target.value)}
                  className={inputClass}
                />
              </div>
            </>
          )}

          {/* Pay Out-specific fields */}
          {tab === 'pay_out' && (
            <div className="mb-4">
              <label className={labelClass}>
                Purpose <span className="text-gray-300">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Supplies, Petty cash, Staff meal"
                value={category}
                onChange={e => setCategory(e.target.value)}
                className={inputClass}
              />
            </div>
          )}

          {/* Note — both tabs */}
          <div className="mb-4">
            <label className={labelClass}>
              Note <span className="text-gray-300">(optional)</span>
            </label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* V1 notice */}
          <div className="bg-gray-50 rounded-xl px-3 py-2.5 mb-2">
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Adjustments are tracked for owner visibility. They are not included in the drawer balance in V1.
            </p>
          </div>
        </div>

        <SheetActionFooter className="border-t">
          {error && (
            <div className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2 mb-3">{error}</div>
          )}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-orange-500 text-white font-semibold py-3.5 rounded-2xl disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </SheetActionFooter>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
