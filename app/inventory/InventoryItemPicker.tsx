'use client'

import { useState, useRef, useEffect } from 'react'
import { filterCatalogItems } from '@/lib/purchaseLedger/catalog'
import { categoryColor, categoryOrderIndex } from '@/lib/purchaseLedger/categories'
import type { DisplayStatus, InventoryCatalogItem } from '@/lib/inventory/types'

// ─── Types ───────────────────────────────────────────────────────────────────

type InvStatus = { currentQuantity: number; displayStatus: DisplayStatus }

type Props = {
  items: InventoryCatalogItem[]
  selectedItem: InventoryCatalogItem | null
  onSelect: (item: InventoryCatalogItem) => void
  existingItems?: Map<number, InvStatus>
  placeholder?: string
  disabled?: boolean
  loading?: boolean
  error?: string | null
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SourceBadge({ source }: { source: 'local' | 'china' | 'both' }) {
  if (source === 'china')
    return (
      <span className="inline-flex items-center text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-2 py-px leading-tight">
        China
      </span>
    )
  if (source === 'both')
    return (
      <span className="inline-flex items-center text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-px leading-tight">
        Both
      </span>
    )
  return (
    <span className="inline-flex items-center text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-px leading-tight">
      Local
    </span>
  )
}

function InvStatusBadge({ status, unit }: { status: InvStatus; unit: string }) {
  const { currentQuantity: qty, displayStatus } = status
  if (displayStatus === 'out')
    return (
      <div className="text-right flex-shrink-0 min-w-[72px]">
        <div className="text-xs font-semibold text-red-600 leading-tight">Out of Stock</div>
        <div className="text-xs text-red-400 mt-px leading-tight">0 {unit}</div>
      </div>
    )
  if (displayStatus === 'low')
    return (
      <div className="text-right flex-shrink-0 min-w-[72px]">
        <div className="text-xs font-semibold text-orange-600 leading-tight">Low Stock</div>
        <div className="text-xs text-gray-400 mt-px leading-tight">{qty} {unit}</div>
      </div>
    )
  return (
    <div className="text-right flex-shrink-0 min-w-[72px]">
      <div className="text-xs font-semibold text-green-700 leading-tight">In Inventory</div>
      <div className="text-xs text-gray-400 mt-px leading-tight">{qty} {unit}</div>
    </div>
  )
}

// ─── Filter ──────────────────────────────────────────────────────────────────

const HAN = /\p{Script=Han}/u

function filterInventoryItems(items: InventoryCatalogItem[], query: string): InventoryCatalogItem[] {
  const q = query.trim()
  if (!q) return items

  // Chinese character queries → name search only
  if (HAN.test(q)) return filterCatalogItems(items, q) as InventoryCatalogItem[]

  const ql = q.toLowerCase()

  if (ql.length >= 3) {
    // Category search (e.g. "Sauces", "Packaging")
    const byCategory = items.filter(i => i.category.toLowerCase().startsWith(ql))
    if (byCategory.length > 0) return byCategory

    // Source search (e.g. "china", "local", "both")
    const bySource = items.filter(i => i.purchaseSource.toLowerCase().startsWith(ql))
    if (bySource.length > 0) return bySource

    // Unit search (e.g. "tub", "roll", "bottle")
    const byUnit = items.filter(i => i.unit.toLowerCase().startsWith(ql) || i.unit.toLowerCase() === ql)
    if (byUnit.length > 0) return byUnit
  }

  // Fall back to name search — handles Latin pinyin, name_ms, fuzzy
  return filterCatalogItems(items, q) as InventoryCatalogItem[]
}

// ─── Sort ─────────────────────────────────────────────────────────────────────

function sortItems(items: InventoryCatalogItem[], existing: Map<number, InvStatus> | undefined): InventoryCatalogItem[] {
  return [...items].sort((a, b) => {
    // Available items first, existing inventory second
    const aExists = existing?.has(a.id) ? 1 : 0
    const bExists = existing?.has(b.id) ? 1 : 0
    if (aExists !== bExists) return aExists - bExists
    // Within each group: category order then name
    const catDiff = categoryOrderIndex(a.category) - categoryOrderIndex(b.category)
    if (catDiff !== 0) return catDiff
    return a.name_zh.localeCompare(b.name_zh, 'zh')
  })
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function InventoryItemPicker({
  items,
  selectedItem,
  onSelect,
  existingItems,
  placeholder = 'Select Inventory Item...',
  disabled,
  loading,
  error,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [inputFocused, setInputFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [dupToast, setDupToast] = useState<string | null>(null)
  const dupTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => setKeyboardHeight(0), 0)
      return () => clearTimeout(t)
    }
    const vv = window.visualViewport
    if (!vv) return
    function update() {
      const kh = window.innerHeight - vv!.height
      setKeyboardHeight(kh > 0 ? kh : 0)
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [open])

  useEffect(() => {
    return () => { if (dupTimer.current) clearTimeout(dupTimer.current) }
  }, [])

  const sorted = sortItems(items, existingItems)
  const filtered = filterInventoryItems(sorted, query)
  const available = filtered.filter(i => !existingItems?.has(i.id))
  const inInventory = filtered.filter(i => existingItems?.has(i.id))

  function close() {
    setOpen(false)
    setQuery('')
    setInputFocused(false)
    setDupToast(null)
  }

  function handleInputTap() {
    setInputFocused(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function handleTapExisting(item: InventoryCatalogItem) {
    if (dupTimer.current) clearTimeout(dupTimer.current)
    setDupToast(`${item.name_zh} is already being tracked in inventory`)
    dupTimer.current = setTimeout(() => setDupToast(null), 2500)
  }

  function renderRow(item: InventoryCatalogItem) {
    const status = existingItems?.get(item.id)
    const isExisting = !!status
    const active = item.id === selectedItem?.id
    const catCol = categoryColor(item.category)

    return (
      <button
        key={item.id}
        type="button"
        onClick={() => {
          if (isExisting) { handleTapExisting(item); return }
          onSelect(item)
          close()
        }}
        className="w-full text-left px-4 py-2.5 border-b border-gray-50 last:border-0 active:bg-orange-50"
        style={{ background: isExisting ? '#f9fafb' : active ? '#fff7ed' : undefined }}
      >
        <div className="flex items-start gap-3">
          {/* Left: names + badges */}
          <div className="flex-1 min-w-0">
            <div
              className="font-medium leading-snug truncate"
              style={{ fontSize: 15, color: isExisting ? '#9ca3af' : active ? '#f97316' : '#111827' }}
            >
              {item.name_zh}
            </div>
            <div className="text-gray-400 text-xs leading-snug truncate mt-px min-h-[15px]">
              {item.name_ms ?? ''}
            </div>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span
                className="text-xs font-medium rounded-full px-2 py-px leading-tight"
                style={{
                  color: isExisting ? '#9ca3af' : catCol,
                  background: isExisting ? '#f3f4f6' : catCol + '1a',
                }}
              >
                {item.category}
              </span>
              <span className="text-xs text-gray-400 leading-tight">{item.unit}</span>
              <span className="text-gray-300 text-xs">·</span>
              <SourceBadge source={item.purchaseSource} />
            </div>
          </div>
          {/* Right: inventory status OR checkmark */}
          {isExisting ? (
            <InvStatusBadge status={status} unit={item.unit} />
          ) : active ? (
            <svg
              width="16" height="16" viewBox="0 0 24 24"
              fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round"
              className="flex-shrink-0 mt-1"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : null}
        </div>
      </button>
    )
  }

  return (
    <>
      {/* ── Trigger ───────────────────────────────────── */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-left flex items-center justify-between bg-white"
        style={{ fontSize: 16 }}
      >
        <div className="flex-1 min-w-0">
          {selectedItem ? (
            <>
              <div className="text-gray-900 font-medium truncate leading-tight">{selectedItem.name_zh}</div>
              {selectedItem.name_ms && (
                <div className="text-gray-400 text-xs truncate leading-tight mt-0.5">{selectedItem.name_ms}</div>
              )}
            </>
          ) : error ? (
            <span className="text-red-500 text-xs break-all">{error}</span>
          ) : loading ? (
            <span className="text-gray-400">Loading catalog…</span>
          ) : (
            <span className="text-gray-400">{placeholder}</span>
          )}
        </div>
        {!disabled && (
          <svg
            width="14" height="14" viewBox="0 0 24 24"
            fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="flex-shrink-0 ml-2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </button>

      {/* ── Bottom sheet ──────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-[70] flex flex-col justify-end"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={close}
        >
          <div
            className="bg-white rounded-t-3xl flex flex-col"
            style={{
              maxHeight: keyboardHeight > 0
                ? `calc(${window.innerHeight - keyboardHeight}px - 16px)`
                : '82vh',
              paddingBottom: keyboardHeight > 0
                ? keyboardHeight
                : 'calc(env(safe-area-inset-bottom, 0px) + 20px)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-4 pt-5 pb-3 flex items-center justify-between flex-shrink-0 border-b border-gray-100">
              <span className="font-semibold text-base">Select Inventory Item</span>
              <button onClick={close} className="text-gray-400 text-2xl leading-none">×</button>
            </div>

            {/* Duplicate toast */}
            {dupToast && (
              <div className="mx-4 mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl flex-shrink-0">
                <span className="text-xs text-amber-700">{dupToast}</span>
              </div>
            )}

            {/* Search */}
            <div className="px-4 pt-3 pb-2 flex-shrink-0">
              {inputFocused ? (
                <input
                  ref={inputRef}
                  className="w-full border border-orange-400 rounded-xl px-3 py-2.5 outline-none"
                  style={{ fontSize: 16 }}
                  placeholder="Search item name..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onBlur={() => { if (!query) setInputFocused(false) }}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                />
              ) : (
                <button
                  type="button"
                  onClick={handleInputTap}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-left text-gray-400 bg-white"
                  style={{ fontSize: 16 }}
                >
                  {query || '🔍 Search item name...'}
                </button>
              )}
            </div>

            {/* Count hint */}
            <div className="px-4 pb-1.5 flex-shrink-0">
              {query ? (
                <span className="text-xs text-gray-400">
                  {filtered.length} result{filtered.length !== 1 ? 's' : ''}
                </span>
              ) : (
                <span className="text-xs text-gray-400">
                  {available.length} available · {inInventory.length} already tracked
                </span>
              )}
            </div>

            {/* List */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              {error ? (
                <div className="mx-4 my-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                  <div className="text-red-600 text-sm font-semibold mb-2">Catalog load error</div>
                  <div className="text-red-500 text-xs font-mono break-all">{error}</div>
                </div>
              ) : loading ? (
                <div className="text-center text-gray-400 py-10 text-sm">Loading…</div>
              ) : filtered.length === 0 ? (
                <div className="text-center text-gray-400 py-10 text-sm">No items found</div>
              ) : (
                <>
                  {available.map(item => renderRow(item))}
                  {inInventory.length > 0 && (
                    <>
                      <div className="px-4 py-2 bg-gray-50 border-y border-gray-100">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                          Already in Inventory
                        </span>
                      </div>
                      {inInventory.map(item => renderRow(item))}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
