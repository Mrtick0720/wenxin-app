'use client'

import { useState, useRef, useEffect } from 'react'
import { useStaff } from '@/app/components/StaffProvider'
import {
  filterCatalogItems,
  isLatinDisplayRole,
  resolveCatalogDisplayName,
  type CatalogItem,
} from '@/lib/purchaseLedger/catalog'

type Props = {
  items: CatalogItem[]
  selectedItem: CatalogItem | null
  onSelect: (item: CatalogItem) => void
  placeholder?: string
  disabled?: boolean
  loading?: boolean
  error?: string | null
}

export default function CatalogCombobox({
  items,
  selectedItem,
  onSelect,
  placeholder = 'Select item...',
  disabled,
  loading,
  error,
}: Props) {
  const staff = useStaff()
  const latinOnly = isLatinDisplayRole(staff?.role)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [inputFocused, setInputFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Track keyboard height via visualViewport so the sheet stays above the keyboard
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  useEffect(() => {
    if (!open) {
      // Defer reset so it's not a synchronous setState in the effect body
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

  const filteredItems = filterCatalogItems(items, query)
  const searchPlaceholder = latinOnly ? 'Search item…' : '中文 / Malay…'
  const displayName = (item: CatalogItem) =>
    resolveCatalogDisplayName(item.name_zh, items, latinOnly ? 'latin' : 'default')

  // Do NOT auto-focus the search input on open — it triggers the Android
  // keyboard instantly, hiding the item list. The input only gains focus
  // when the user explicitly taps inside it.

  function close() { setOpen(false); setQuery(''); setInputFocused(false) }

  function handleInputTap() {
    setInputFocused(true)
    // Defer focus so the state update above commits first
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const triggerCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-left flex items-center justify-between bg-white'

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={triggerCls}
        style={{ fontSize: 16 }}
      >
        <div className="flex-1 min-w-0 text-left">
          {selectedItem ? (
            latinOnly ? (
              <div className="text-gray-900 font-semibold truncate">
                {displayName(selectedItem)}
              </div>
            ) : (
              <>
                <div className="text-gray-900 truncate">{selectedItem.name_zh}</div>
                {selectedItem.name_ms && (
                <div className="text-gray-400 text-xs truncate leading-tight">{selectedItem.name_ms}</div>
                )}
              </>
            )
          ) : error ? (
            <span className="text-red-500 text-xs break-all">{error}</span>
          ) : loading ? (
            <span className="text-gray-400">Loading catalog…</span>
          ) : (
            <span className="text-gray-400">{placeholder}</span>
          )}
        </div>
        {!disabled && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 ml-2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </button>

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
              paddingBottom: keyboardHeight > 0 ? keyboardHeight : 'calc(env(safe-area-inset-bottom,0px) + 20px)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-4 pt-5 pb-3 flex items-center justify-between flex-shrink-0 border-b border-gray-100">
              <span className="font-semibold text-base">Select Item</span>
              <button onClick={close} className="text-gray-400 text-2xl leading-none">×</button>
            </div>

            {/* Search — shown as a tappable row; only focuses input on explicit tap */}
            <div className="px-4 pt-3 pb-2 flex-shrink-0">
              {inputFocused ? (
                <input
                  ref={inputRef}
                  className="w-full border border-orange-400 rounded-xl px-3 py-2.5 outline-none"
                  style={{ fontSize: 16 }}
                  placeholder={searchPlaceholder}
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
                  {query || `🔍 ${searchPlaceholder}`}
                </button>
              )}
            </div>

            {/* List */}
            <div className="min-h-[220px] max-h-[360px] overflow-y-auto">
              {error ? (
                <div className="mx-4 my-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                  <div className="text-red-600 text-sm font-semibold mb-2">Catalog load error</div>
                  <div className="text-red-500 text-xs font-mono break-all">{error}</div>
                </div>
              ) : loading ? (
                <div className="text-center text-gray-400 py-10 text-sm">Loading…</div>
              ) : filteredItems.length === 0 ? (
                <div className="text-center text-gray-400 py-10 text-sm">No items found</div>
              ) : (
                filteredItems.map((item) => {
                  const active = item.id === selectedItem?.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => { onSelect(item); close() }}
                      className="w-full text-left px-4 py-3 border-b border-gray-50 last:border-0 flex items-center justify-between active:bg-orange-50"
                      style={{ background: active ? '#fff7ed' : undefined }}
                    >
                      <div className="flex-1 min-w-0">
                        <div
                          className="font-medium truncate"
                          style={{ fontSize: 16, color: active ? '#f97316' : '#111827' }}
                        >
                          {displayName(item)}
                        </div>
                        {!latinOnly && item.name_ms && (
                          <div className="text-gray-400 text-xs truncate mt-0.5">{item.name_ms}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                        <span className="text-xs text-gray-400">{item.unit}</span>
                        {active && (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
