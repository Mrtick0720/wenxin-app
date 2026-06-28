'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { CATEGORY_COUNT_PERMISSIONS } from '@/lib/inventory/permissions'
import { fetchCountItemsAction, saveCountAction } from './count-actions'
import type { CountItem, CountEntry } from '@/lib/inventory/types'
import { SheetActionFooter } from '@/components/ui/SheetActionFooter'
import { useGlobalToast } from '@/app/components/GlobalToast'

type Props = {
  isOpen: boolean
  role: string
  initialCategory?: string
  onClose: () => void
  onSaved: () => void
}

type Screen = 'category' | 'items'

export default function CountSheet({ isOpen, role, initialCategory, onClose, onSaved }: Props) {
  const { showToast } = useGlobalToast()
  const [screen, setScreen] = useState<Screen>(initialCategory ? 'items' : 'category')
  const [category, setCategory] = useState<string>(initialCategory ?? '')
  const [items, setItems] = useState<CountItem[]>([])
  const [quantities, setQuantities] = useState<Record<number, string>>({})
  const [openedQtys, setOpenedQtys] = useState<Record<number, string>>({})
  const [loadingItems, setLoadingItems] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Reset state when overlay opens
  useEffect(() => {
    if (isOpen) {
      setScreen(initialCategory ? 'items' : 'category')
      setCategory(initialCategory ?? '')
      setItems([])
      setQuantities({})
      setOpenedQtys({})
      setLoadingItems(false)
      setLoadError(null)
      setSaving(false)
      setSaveError(null)
    }
  }, [isOpen, initialCategory])

  // Load items when we land on the items screen
  useEffect(() => {
    if (!isOpen || !category || screen !== 'items') return

    setLoadingItems(true)
    setLoadError(null)
    setItems([])

    fetchCountItemsAction(category).then(result => {
      if (result.ok) {
        setItems(result.data)
        const initQty: Record<number, string> = {}
        const initOpened: Record<number, string> = {}
        result.data.forEach(item => {
          initQty[item.id] = String(item.currentQuantity)
          initOpened[item.id] = String(item.openedQuantity)
        })
        setQuantities(initQty)
        setOpenedQtys(initOpened)
      } else {
        setLoadError(result.error)
      }
      setLoadingItems(false)
    })
  }, [isOpen, category, screen])

  // Validation: check if any sauce item has opened > total
  const hasValidationError = items.some(item => {
    if (!item.trackOpened) return false
    const total = parseFloat(quantities[item.id] ?? '0') || 0
    const opened = parseFloat(openedQtys[item.id] ?? '0') || 0
    return opened > total
  })

  async function handleSave() {
    if (hasValidationError || saving) return
    setSaving(true)
    setSaveError(null)

    const entries: CountEntry[] = items.map(item => ({
      item_id: item.id,
      new_quantity: parseFloat(quantities[item.id] ?? '0') || 0,
      opened_quantity: item.trackOpened
        ? (parseFloat(openedQtys[item.id] ?? '0') || 0)
        : 0,
    }))

    // Optimistic: show success + close immediately
    showToast(`Count saved — ${category}`)
    onSaved()
    onClose()

    const result = await saveCountAction(entries, category)
    if (!result.ok) {
      showToast(result.error, 'error')
      onSaved()  // refetch to rollback
    }
  }

  const allowedCategories = CATEGORY_COUNT_PERMISSIONS[role] ?? []

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[500] bg-white flex flex-col">

      {/* ── Screen 1: Category selector ── */}
      {screen === 'category' && (
        <>
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b">
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

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-4 pt-5 pb-8">
            <p className="text-sm text-gray-500 mb-4">Select a category to count:</p>
            <div className="flex flex-wrap gap-2">
              {allowedCategories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setCategory(cat)
                    setScreen('items')
                  }}
                  className="px-4 py-2 rounded-full bg-gray-100 text-gray-700 text-sm font-medium hover:bg-orange-50 hover:text-orange-600 transition-colors"
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Screen 2: Item list ── */}
      {screen === 'items' && (
        <>
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b">
            {initialCategory ? (
              <button
                type="button"
                onClick={onClose}
                className="text-gray-500 text-lg leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
                aria-label="Close"
              >
                ✕
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setScreen('category')
                  setItems([])
                  setLoadError(null)
                }}
                className="text-gray-500 text-base w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
                aria-label="Back"
              >
                ←
              </button>
            )}
            <span className="font-semibold text-base flex-1">{category}</span>
          </div>

          {/* Body — min-h-0 required: without it flex-1 can't shrink below content height,
               causing overflow that pushes the save bar off-screen */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-4 space-y-3">
            {loadingItems ? (
              <div className="text-center py-16 text-sm text-gray-400">Loading items...</div>
            ) : loadError ? (
              <div className="bg-red-50 rounded-2xl p-4 text-sm text-red-500">{loadError}</div>
            ) : items.length === 0 ? (
              <div className="text-center py-16 text-sm text-gray-400">No items in this category</div>
            ) : (
              items.map(item => (
                <div key={item.id} className="bg-gray-50 rounded-2xl p-4 space-y-3">
                  {/* Name + unit */}
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      {item.name}{' '}
                      <span className="font-normal text-gray-400">({item.unit})</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      Currently: {item.currentQuantity} {item.unit}
                    </div>
                  </div>

                  {/* Total counted input */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500 w-28 flex-shrink-0">
                      Total counted
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      value={quantities[item.id] ?? ''}
                      onChange={e =>
                        setQuantities(prev => ({ ...prev, [item.id]: e.target.value }))
                      }
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-orange-400"
                    />
                    <span className="text-xs text-gray-400 w-12 flex-shrink-0">{item.unit}</span>
                  </div>

                  {/* track_opened items: show opened qty input */}
                  {item.trackOpened && (
                    <>
                      {(() => {
                        const total = parseFloat(quantities[item.id] ?? '0') || 0
                        const opened = parseFloat(openedQtys[item.id] ?? '0') || 0
                        const openedExceedsTotal = opened > total
                        return (
                          <>
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-gray-500 w-28 flex-shrink-0">
                                Opened
                              </label>
                              <input
                                type="number"
                                inputMode="decimal"
                                min="0"
                                value={openedQtys[item.id] ?? ''}
                                onChange={e =>
                                  setOpenedQtys(prev => ({ ...prev, [item.id]: e.target.value }))
                                }
                                className={`flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none ${
                                  openedExceedsTotal
                                    ? 'border-red-400 focus:border-red-400'
                                    : 'border-gray-200 focus:border-orange-400'
                                }`}
                              />
                              <span className="text-xs text-gray-400 w-12 flex-shrink-0">{item.unit}</span>
                            </div>
                            {openedExceedsTotal ? (
                              <p className="text-xs text-red-500">Opened cannot exceed total</p>
                            ) : (
                              <p className="text-xs text-gray-400">
                                Unopened: {Math.max(0, total - opened)} {item.unit}
                              </p>
                            )}
                          </>
                        )
                      })()}
                    </>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Save bar — keyboard-aware, pinned to bottom of the flex column */}
          {items.length > 0 && (
            <SheetActionFooter className="border-t">
              {saveError && (
                <p className="text-xs text-red-500 mb-2 text-center">{saveError}</p>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={hasValidationError || saving}
                className={`w-full py-3 rounded-2xl text-sm font-semibold transition-colors ${
                  hasValidationError || saving
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-orange-500 text-white active:bg-orange-600'
                }`}
              >
                {saving ? 'Saving...' : 'Save Count'}
              </button>
            </SheetActionFooter>
          )}
        </>
      )}
    </div>,
    document.body
  )
}
