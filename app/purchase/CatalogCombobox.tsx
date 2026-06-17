'use client'

import { useState, useRef, useEffect } from 'react'
import { filterCatalogItems, type CatalogItem } from '@/lib/purchaseLedger/catalog'

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
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const filteredItems = filterCatalogItems(items, query)

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80)
  }, [open])

  function close() { setOpen(false); setQuery('') }

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
            <>
              <div className="text-gray-900 truncate">{selectedItem.name_zh}</div>
              {selectedItem.name_ms && (
                <div className="text-gray-400 text-xs truncate leading-tight">{selectedItem.name_ms}</div>
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
            style={{ maxHeight: '82vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-4 pt-5 pb-3 flex items-center justify-between flex-shrink-0 border-b border-gray-100">
              <span className="font-semibold text-base">Select Item</span>
              <button onClick={close} className="text-gray-400 text-2xl leading-none">×</button>
            </div>

            {/* Search */}
            <div className="px-4 pt-3 pb-2 flex-shrink-0">
              <input
                ref={inputRef}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-orange-400"
                style={{ fontSize: 16 }}
                placeholder="中文 / Malay…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
              />
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
                          {item.name_zh}
                        </div>
                        {item.name_ms && (
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
