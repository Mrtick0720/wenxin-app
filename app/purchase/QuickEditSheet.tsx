'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { updateRecordAction } from './actions'
import type { LedgerRecord } from './PurchaseClient'

const UNITS = ['kg', 'g', 'pcs', 'pack', 'box', 'bottle', 'bag', 'tray', 'bundle', 'carton', 'pail', 'portion']
const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'DuitNow', 'Credit', 'Other']
const PAYMENT_STATUSES = ['Paid', 'Unpaid'] as const

type QuickRecord = {
  id: number
  name: string
  date: string
  specification: string | null
  category: string
  unit: string
  quantity: number
  unit_price?: number | null
  supplier?: string | null
  purchaser?: string | null
  receiver?: string | null
  created_by_name?: string | null
  verified_by_name?: string | null
  note?: string | null
  purchase_method?: string | null
  payment_status?: string | null
}

type Props = {
  record: QuickRecord
  showCosts: boolean
  onClose: () => void
  onOptimisticSave: (optimistic: LedgerRecord) => void
  onSaveFailed: (original: QuickRecord) => void
}

const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
}

function rm(n: number) { return `RM ${n.toFixed(2)}` }

const Z_MAX = 2147483647

export default function QuickEditSheet({ record, showCosts, onClose, onOptimisticSave, onSaveFailed }: Props) {
  const [quantity, setQuantity] = useState(String(record.quantity || ''))
  const [unit, setUnit] = useState(record.unit)
  const [unitPrice, setUnitPrice] = useState(record.unit_price != null ? String(record.unit_price) : '')
  const [supplier, setSupplier] = useState(record.supplier ?? '')
  const [note, setNote] = useState(record.note ?? '')
  const [paymentMethod, setPaymentMethod] = useState(record.purchase_method ?? '')
  const [paymentStatus, setPaymentStatus] = useState(record.payment_status ?? 'Unpaid')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unitOpen, setUnitOpen] = useState(false)

  const qty = parseFloat(quantity) || 0
  const up = parseFloat(unitPrice) || 0
  const total = qty * up

  async function handleSave() {
    if (!quantity || qty <= 0) { setError('Quantity must be greater than zero.'); return }
    setSaving(true)
    setError(null)

    const updatedQty = qty
    const updatedUp = showCosts && unitPrice ? up : (record.unit_price ?? 0)

    const optimistic = {
      ...(record as unknown as LedgerRecord),
      quantity: updatedQty,
      unit,
      unit_price: showCosts ? updatedUp : null,
      total_price: showCosts ? updatedQty * updatedUp : null,
      supplier: showCosts ? supplier.trim() || null : null,
      note: note.trim() || null,
      purchase_method: paymentMethod || null,
      payment_status: paymentStatus,
    } as unknown as LedgerRecord

    onClose()
    onOptimisticSave(optimistic)

    const res = await updateRecordAction(record.id, {
      name: record.name,
      specification: record.specification ?? null,
      category: record.category,
      unit,
      quantity: updatedQty,
      unit_price: showCosts && unitPrice ? updatedUp : null,
      supplier: showCosts ? supplier.trim() || null : null,
      purchaser: record.purchaser ?? null,
      receiver: record.receiver ?? null,
      remarks: note.trim() || null,
      purchase_method: paymentMethod || undefined,
      payment_status: paymentStatus,
    })

    if (!res.ok) onSaveFailed(record)
  }

  const content = (
    <div
      className="fixed flex flex-col justify-end"
      style={{ top: 0, left: 0, right: 0, bottom: 0, zIndex: Z_MAX, background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl flex flex-col"
        style={{ maxHeight: '92vh', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 pt-5 pb-3 flex items-center justify-between flex-shrink-0 border-b border-gray-100">
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-base truncate">{record.name}</div>
            <div className="text-sm text-gray-400 mt-0.5">
              {record.purchaser ? `Purchased by ${record.purchaser}` : ''}
              {record.purchaser && (record.verified_by_name ?? record.receiver) ? ' · ' : ''}
              {(record.verified_by_name ?? record.receiver) ? `Received by ${record.verified_by_name ?? record.receiver}` : ''}
              {!record.purchaser && !record.verified_by_name && !record.receiver ? record.category : ''}
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 text-2xl leading-none ml-3">×</button>
        </div>

        {/* Form */}
        <div className="px-4 pt-4 pb-4 overflow-y-auto flex-1 min-h-0 space-y-3">
          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>
          )}

          {/* Locked purchase date */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Purchase Date</label>
            <div className="w-full border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 text-gray-600" style={{ fontSize: 16 }}>
              {fmtDate(record.date)}
            </div>
          </div>

          {/* Quantity + Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Quantity *</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-orange-400"
                style={{ fontSize: 16 }} type="number" inputMode="decimal" placeholder="0"
                value={quantity} onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Unit</label>
              <div className="relative">
                <button type="button" onClick={() => setUnitOpen((o) => !o)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-left flex items-center justify-between bg-white"
                  style={{ fontSize: 16 }}>
                  <span className="text-gray-800">{unit}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{ transform: unitOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {unitOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-30 overflow-y-auto" style={{ maxHeight: 220 }}>
                    {UNITS.map((opt) => (
                      <button key={opt} type="button" onClick={() => { setUnit(opt); setUnitOpen(false) }}
                        className="w-full text-left px-3 py-2.5 hover:bg-orange-50"
                        style={{ fontSize: 16, color: opt === unit ? '#f97316' : '#374151', fontWeight: opt === unit ? 600 : 400 }}>
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Note (optional)</label>
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-orange-400"
              style={{ fontSize: 16 }} placeholder="e.g. fresh only" value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {/* Costs — owner/manager only */}
          {showCosts && (
            <>
              {/* Unit Price + Total in one row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Unit Price (RM)</label>
                  <input
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-orange-400"
                    style={{ fontSize: 16 }} type="number" inputMode="decimal" placeholder="0.00"
                    value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Total</label>
                  <div className="w-full border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 text-gray-900 font-semibold" style={{ fontSize: 16 }}>
                    {total > 0 ? rm(total) : '—'}
                  </div>
                </div>
              </div>

              {/* Supplier */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Supplier</label>
                <input
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-orange-400"
                  style={{ fontSize: 16 }} placeholder="Optional" value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                />
              </div>

              {/* Payment Method + Payment Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Payment Method</label>
                  <select
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-orange-400 bg-white"
                    style={{ fontSize: 16 }} value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Payment Status</label>
                  <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
                    {PAYMENT_STATUSES.map(s => (
                      <button key={s} type="button"
                        onClick={() => setPaymentStatus(s)}
                        className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                          paymentStatus === s ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-500'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-gray-100 bg-white px-4 pt-3 pb-3">
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={onClose}
              className="py-3 rounded-2xl text-sm font-semibold bg-gray-100 text-gray-600 active:opacity-80">Cancel</button>
            <button type="button" onClick={handleSave} disabled={saving}
              className="py-3 rounded-2xl text-sm font-semibold text-white active:opacity-90"
              style={{ background: saving ? '#d1d5db' : '#f97316' }}>Save</button>
          </div>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(content, document.body)
}
