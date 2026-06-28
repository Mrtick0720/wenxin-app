'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { saveCountAction } from './count-actions'
import type { InventoryView } from '@/lib/inventory/types'
import { SheetActionFooter } from '@/components/ui/SheetActionFooter'
import { useGlobalToast } from '@/app/components/GlobalToast'

type Reason = 'routine' | 'adjustment'

type Props = {
  item: InventoryView | undefined
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

function fmtDelta(delta: number, unit: string): string {
  if (delta === 0) return `No change`
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta} ${unit}`
}

function deltaClass(delta: number): string {
  if (delta > 0) return 'text-green-600'
  if (delta < 0) return 'text-red-500'
  return 'text-gray-400'
}

export default function CountItemSheet({ item, isOpen, onClose, onSaved }: Props) {
  const { showToast } = useGlobalToast()
  const [newQty, setNewQty] = useState('')
  const [openedQty, setOpenedQty] = useState('')
  const [unopenedQty, setUnopenedQty] = useState('')
  const [reason, setReason] = useState<Reason>('routine')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && item) {
      if (item.trackOpened) {
        setOpenedQty(String(item.openedQuantity))
        setUnopenedQty(String(item.unopenedQuantity))
      } else {
        setNewQty(String(item.currentQuantity))
      }
      setReason('routine')
      setSaving(false)
      setError(null)
    }
  }, [isOpen, item])

  const trackOpened = item?.trackOpened ?? false
  const parsedQty = parseFloat(newQty) || 0
  const parsedOpened = parseFloat(openedQty) || 0
  const parsedUnopened = parseFloat(unopenedQty) || 0
  const totalForOpened = parsedOpened + parsedUnopened

  const validationError = trackOpened
    ? parsedOpened < 0 || parsedUnopened < 0 ? 'Quantities cannot be negative' : null
    : parsedQty < 0 ? 'Quantity cannot be negative' : null

  // Deltas for preview
  const deltaTotal = trackOpened
    ? totalForOpened - (item?.currentQuantity ?? 0)
    : parsedQty - (item?.currentQuantity ?? 0)
  const deltaOpened = parsedOpened - (item?.openedQuantity ?? 0)
  const deltaUnopened = parsedUnopened - (item?.unopenedQuantity ?? 0)

  const notesForMovement = reason === 'routine' ? 'Routine Count' : 'Manual Adjustment'

  async function handleSave() {
    if (saving || !item || validationError) return
    setSaving(true)
    setError(null)

    const entry = trackOpened
      ? { item_id: item.id, new_quantity: totalForOpened, opened_quantity: parsedOpened }
      : { item_id: item.id, new_quantity: parsedQty, opened_quantity: 0 }

    // Optimistic: show success + close immediately
    showToast('Stock updated')
    onSaved()
    onClose()

    const result = await saveCountAction([entry], item.category, notesForMovement)
    if (!result.ok) {
      showToast(result.error, 'error')
      onSaved()  // refetch to rollback
    }
  }

  if (!isOpen || !item) return null

  const lastCounted = item.lastCountedAt
    ? new Date(item.lastCountedAt).toLocaleDateString('en-MY', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'Never'

  return createPortal(
    <div className="fixed inset-0 z-[500] bg-white flex flex-col">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="text-gray-500 text-lg leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
          aria-label="Close"
        >
          ✕
        </button>
        <span className="font-semibold text-base flex-1">Count Stock</span>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-5 pb-4 space-y-6">

        {/* Item info — read-only */}
        <section>
          <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1.5">
            <div className="font-semibold text-gray-900 text-sm">{item.name}</div>
            {item.nameMs && <div className="text-xs text-gray-400">{item.nameMs}</div>}
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-600">
                {item.category}
              </span>
              <span className="text-xs text-gray-300">·</span>
              <span className="text-xs text-gray-500">{item.unit}</span>
            </div>
          </div>
        </section>

        {/* Current stock — read-only */}
        <section className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Current Stock</h3>
          {trackOpened ? (
            <div className="bg-gray-50 rounded-xl px-4 py-3 grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-400 mb-0.5">Opened</div>
                <div className="text-lg font-bold text-gray-900">
                  {item.openedQuantity}{' '}
                  <span className="text-sm font-normal text-gray-400">{item.unit}</span>
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-0.5">Unopened</div>
                <div className="text-lg font-bold text-gray-900">
                  {item.unopenedQuantity}{' '}
                  <span className="text-sm font-normal text-gray-400">{item.unit}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
              <div className="text-2xl font-bold text-gray-900">{item.currentQuantity}</div>
              <div className="text-sm text-gray-400">{item.unit}</div>
            </div>
          )}
          <div className="text-xs text-gray-400 px-1">Last counted: {lastCounted}</div>
        </section>

        {/* New Count inputs */}
        <section className="space-y-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">New Count</h3>

          {trackOpened ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600 w-24 flex-shrink-0">Opened</label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={openedQty}
                  onChange={e => setOpenedQty(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400"
                />
                <span className="text-xs text-gray-400 w-12 flex-shrink-0">{item.unit}</span>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600 w-24 flex-shrink-0">Unopened</label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={unopenedQty}
                  onChange={e => setUnopenedQty(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400"
                />
                <span className="text-xs text-gray-400 w-12 flex-shrink-0">{item.unit}</span>
              </div>
              <div className="text-xs text-gray-400 px-1">
                Total: {totalForOpened} {item.unit}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-600 w-24 flex-shrink-0">New Quantity</label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                value={newQty}
                onChange={e => setNewQty(e.target.value)}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400"
              />
              <span className="text-xs text-gray-400 w-12 flex-shrink-0">{item.unit}</span>
            </div>
          )}
        </section>

        {/* Adjustment preview */}
        <section className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Adjustment</h3>
          {trackOpened ? (
            <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Opened</span>
                <span className={`font-semibold ${deltaClass(deltaOpened)}`}>
                  {fmtDelta(deltaOpened, item.unit)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Unopened</span>
                <span className={`font-semibold ${deltaClass(deltaUnopened)}`}>
                  {fmtDelta(deltaUnopened, item.unit)}
                </span>
              </div>
              <div className="flex justify-between text-sm border-t border-gray-200 pt-1.5 mt-1.5">
                <span className="text-gray-700 font-medium">Total</span>
                <span className={`font-bold ${deltaClass(deltaTotal)}`}>
                  {fmtDelta(deltaTotal, item.unit)}
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl px-4 py-3 flex justify-between items-center">
              <span className="text-sm text-gray-500">Change</span>
              <span className={`text-sm font-bold ${deltaClass(deltaTotal)}`}>
                {fmtDelta(deltaTotal, item.unit)}
              </span>
            </div>
          )}
        </section>

        {/* Reason */}
        <section className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Reason</h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setReason('routine')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                reason === 'routine'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              Routine Count
            </button>
            <button
              type="button"
              onClick={() => setReason('adjustment')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                reason === 'adjustment'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              Manual Adjustment
            </button>
          </div>
        </section>

      </div>

      {/* Save bar */}
      <SheetActionFooter className="border-t">
        {(error || validationError) && (
          <p className="text-xs text-red-500 mb-2 text-center">{error ?? validationError}</p>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={!!validationError || saving}
          className={`w-full py-3 rounded-2xl text-sm font-semibold transition-colors ${
            validationError || saving
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-orange-500 text-white active:bg-orange-600'
          }`}
        >
          {saving ? 'Saving…' : 'Save Count'}
        </button>
      </SheetActionFooter>

    </div>,
    document.body
  )
}
