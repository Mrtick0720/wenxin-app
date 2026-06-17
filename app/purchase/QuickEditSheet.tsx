'use client'

import { useState } from 'react'
import { updateRecordAction } from './actions'

const UNITS = ['kg', 'g', 'pcs', 'pack', 'box', 'bottle', 'bag', 'tray', 'bundle', 'carton', 'pail', 'portion']

// Only the fields this sheet reads from the record
type QuickRecord = {
  id: number
  name: string
  specification: string | null
  category: string
  unit: string
  quantity: number
  unit_price?: number | null
  supplier?: string | null
  purchaser?: string | null
  receiver?: string | null
  note?: string | null
}

type Props = {
  record: QuickRecord
  showCosts: boolean
  onClose: () => void
  onSaved: () => void
}

function rm(n: number) {
  return `RM ${n.toFixed(2)}`
}

export default function QuickEditSheet({ record, showCosts, onClose, onSaved }: Props) {
  const [quantity, setQuantity] = useState(String(record.quantity || ''))
  const [unit, setUnit] = useState(record.unit)
  const [unitPrice, setUnitPrice] = useState(record.unit_price != null ? String(record.unit_price) : '')
  const [supplier, setSupplier] = useState(record.supplier ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unitOpen, setUnitOpen] = useState(false)

  const qty = parseFloat(quantity) || 0
  const up = parseFloat(unitPrice) || 0
  const total = qty * up

  async function handleSave() {
    if (!quantity || parseFloat(quantity) <= 0) {
      setError('Quantity must be greater than zero.')
      return
    }
    setSaving(true)
    setError(null)
    const res = await updateRecordAction(record.id, {
      name: record.name,
      specification: record.specification ?? null,
      category: record.category,
      unit,
      quantity: parseFloat(quantity),
      unit_price: showCosts && unitPrice ? parseFloat(unitPrice) : null,
      supplier: showCosts ? supplier.trim() || null : null,
      purchaser: record.purchaser ?? null,
      receiver: record.receiver ?? null,
      remarks: record.note ?? null,
    })
    setSaving(false)
    if (!res.ok) { setError(res.error); return }
    onSaved()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[400] flex flex-col justify-end"
      style={{ background: 'rgba(0,0,0,0.4)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 56px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl flex flex-col"
        style={{ maxHeight: 'calc(92vh - env(safe-area-inset-bottom, 0px) - 56px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 pt-5 pb-3 flex items-center justify-between flex-shrink-0 border-b border-gray-100">
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-base truncate">{record.name}</div>
            <div className="text-xs text-gray-400 mt-0.5">{record.category}</div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 text-2xl leading-none ml-3">×</button>
        </div>

        {/* Form */}
        <div className="px-4 pt-4 pb-4 overflow-y-auto flex-1 min-h-0 space-y-3">
          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>
          )}

          {/* Quantity + Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Quantity *</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-orange-400"
                style={{ fontSize: 16 }}
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Unit</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setUnitOpen((o) => !o)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-left flex items-center justify-between bg-white"
                  style={{ fontSize: 16 }}
                >
                  <span className="text-gray-800">{unit}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{ transform: unitOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {unitOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-30 overflow-y-auto" style={{ maxHeight: 220 }}>
                    {UNITS.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => { setUnit(opt); setUnitOpen(false) }}
                        className="w-full text-left px-3 py-2.5 hover:bg-orange-50"
                        style={{ fontSize: 16, color: opt === unit ? '#f97316' : '#374151', fontWeight: opt === unit ? 600 : 400 }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Unit Price + Total + Supplier — owner/manager only */}
          {showCosts && (
            <>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Unit Price (RM)</label>
                <input
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-orange-400"
                  style={{ fontSize: 16 }}
                  type="number"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between py-1 px-0.5">
                <span className="text-xs text-gray-400">Total</span>
                <span className="text-sm font-semibold text-gray-900">{total > 0 ? rm(total) : '—'}</span>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Supplier</label>
                <input
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-orange-400"
                  style={{ fontSize: 16 }}
                  placeholder="Optional"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex-shrink-0 border-t border-gray-100 bg-white px-4 pt-3"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
        >
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onClose}
              className="py-3 rounded-2xl text-sm font-semibold bg-gray-100 text-gray-600 active:opacity-80"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="py-3 rounded-2xl text-sm font-semibold text-white active:opacity-90"
              style={{ background: saving ? '#d1d5db' : '#f97316' }}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
