'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { receiveStockAction } from './receive-actions'
import type { InventoryView } from '@/lib/inventory/types'
import { SheetActionFooter } from '@/components/ui/SheetActionFooter'

type Props = {
  item: InventoryView | undefined
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

export default function ReceiveStockSheet({ item, isOpen, onClose, onSaved }: Props) {
  const [receivedQty, setReceivedQty] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && item) {
      setReceivedQty('')
      setSaving(false)
      setError(null)
      setToast(null)
    }
  }, [isOpen, item])

  const parsedQty = parseFloat(receivedQty) || 0
  const validationError = parsedQty <= 0 && receivedQty !== '' ? 'Quantity must be greater than zero' : null
  const canSave = receivedQty !== '' && parsedQty > 0

  const trackOpened = item?.trackOpened ?? false
  const newTotal = (item?.currentQuantity ?? 0) + parsedQty
  const newUnopened = (item?.unopenedQuantity ?? 0) + parsedQty

  async function handleSave() {
    if (saving || !item || !canSave) return
    setSaving(true)
    setError(null)

    const result = await receiveStockAction(item.id, parsedQty, 'Purchase Received')
    setSaving(false)

    if (result.ok) {
      setToast('Stock received')
      onSaved()
      setTimeout(() => { setToast(null); onClose() }, 1200)
    } else {
      setError(result.error)
    }
  }

  if (!isOpen || !item) return null

  return createPortal(
    <div className="fixed inset-0 z-[500] bg-white flex flex-col">

      {/* Toast */}
      {toast && (
        <div className="fixed top-0 inset-x-0 z-[210] bg-green-500 text-white text-sm font-medium text-center py-3 px-4">
          {toast}
        </div>
      )}

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
        <span className="font-semibold text-base flex-1">Receive Stock</span>
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
        </section>

        {/* Received quantity */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            {trackOpened ? 'Received (Unopened)' : 'Received Quantity'}
          </h3>
          <div className="flex items-center gap-3">
            <input
              type="number"
              inputMode="decimal"
              min="0"
              value={receivedQty}
              onChange={e => setReceivedQty(e.target.value)}
              placeholder="0"
              className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-lg font-semibold focus:outline-none focus:border-orange-400 text-gray-900"
            />
            <span className="text-sm text-gray-500 w-16 flex-shrink-0">{item.unit}</span>
          </div>
          {trackOpened && (
            <p className="text-xs text-gray-400 px-1">
              New stock goes to Unopened. Opening is tracked separately.
            </p>
          )}
        </section>

        {/* New stock preview */}
        {canSave && (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">New Stock</h3>
            {trackOpened ? (
              <div className="bg-green-50 rounded-xl px-4 py-3 grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">Opened</div>
                  <div className="text-lg font-bold text-green-700">
                    {item.openedQuantity}{' '}
                    <span className="text-sm font-normal text-green-500">{item.unit}</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">Unopened</div>
                  <div className="text-lg font-bold text-green-700">
                    {newUnopened}{' '}
                    <span className="text-sm font-normal text-green-500">{item.unit}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-green-50 rounded-xl px-4 py-3 flex items-center justify-between">
                <div className="text-2xl font-bold text-green-700">{newTotal}</div>
                <div className="text-sm text-green-500">{item.unit}</div>
              </div>
            )}
            <div className="flex items-center gap-1 px-1">
              <span className="text-xs text-green-600 font-medium">
                +{parsedQty} {item.unit}
              </span>
              <span className="text-xs text-gray-400">added to stock</span>
            </div>
          </section>
        )}

        {/* Reason — always Purchase Received */}
        <section className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Reason</h3>
          <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-600">
            Purchase Received
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
          disabled={!canSave || saving}
          className={`w-full py-3 rounded-2xl text-sm font-semibold transition-colors ${
            !canSave || saving
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-orange-500 text-white active:bg-orange-600'
          }`}
        >
          {saving ? 'Saving…' : 'Receive Stock'}
        </button>
      </SheetActionFooter>

    </div>,
    document.body
  )
}
