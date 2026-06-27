'use client'

import { useState, useEffect, useMemo } from 'react'
import BackButton from '../components/BackButton'
import PageTransition from '../components/PageTransition'
import { fetchInventoryAction } from './actions'
import { INVENTORY_CATEGORIES } from '@/lib/inventory/status'
import type { InventoryView, DisplayStatus } from '@/lib/inventory/types'
import { useStaff } from '../components/StaffProvider'
import { CATEGORY_COUNT_PERMISSIONS, canCountCategory } from '@/lib/inventory/permissions'
import CountSheet from './CountSheet'
import { canManageInventory } from '@/lib/inventory/permissions'
import ItemSheet from './ItemSheet'
import ItemActionSheet from './ItemActionSheet'
import CountItemSheet from './CountItemSheet'
import ReceiveStockSheet from './ReceiveStockSheet'

// ── Stale-while-revalidate module-level cache ────────────────────────
//
// Lives outside the component so it survives unmount. This is the standard
// caching model for all stack modules (Purchase, Inventory, Staff, Bento…).
//
// Algorithm:
//   No cache  → foreground fetch → loading skeleton → render → write cache
//   Cache fresh (< TTL) → render immediately → do nothing
//   Cache stale (≥ TTL) → render immediately → background refresh →
//                          if data changed: update state + cache
//                          always: reset cachedAt
//
// Invariants:
//   • The loading skeleton is shown ONLY on the very first visit (cache === null).
//   • TTL expiry never discards the cache or shows a skeleton.
//   • Cache is only invalidated on auth/permission failure (caught by SessionHeartbeat)
//     or on full-page reload (logout tears down module scope).
//   • Errors are never cached. Background-refresh errors are swallowed silently.
//   • setItems() is skipped when the new data is byte-for-byte identical to the
//     cached data, avoiding unnecessary React reconciliation passes.
type InventoryCache = {
  items: InventoryView[]
  cachedAt: number
}
let inventoryCache: InventoryCache | null = null
const CACHE_TTL_MS = 5 * 60 * 1000

// ── Status config ────────────────────────────────────────────────────
const STATUS_BADGE: Record<DisplayStatus, { label: string; textClass: string; bgClass: string }> = {
  out:          { label: 'Out of Stock', textClass: 'text-white',       bgClass: 'bg-red-600' },
  low:          { label: 'Low Stock',    textClass: 'text-white',       bgClass: 'bg-orange-500' },
  need_reorder: { label: 'Need Reorder', textClass: 'text-amber-900',   bgClass: 'bg-amber-300' },
  need_count:   { label: 'Need Count',   textClass: 'text-blue-700',    bgClass: 'bg-blue-100' },
  ok:           { label: 'OK',           textClass: 'text-green-800',   bgClass: 'bg-green-200' },
}

const CARD_BG: Record<DisplayStatus, string> = {
  ok:           'bg-green-100',
  low:          'bg-orange-100',
  need_reorder: 'bg-amber-200',
  need_count:   'bg-blue-50',
  out:          'bg-red-200',
}

const CARD_SHADOW: Partial<Record<DisplayStatus, string>> = {
  out:          '0 0 0 1px rgba(220,38,38,0.22), 0 4px 16px rgba(220,38,38,0.18)',
  low:          '0 2px 8px rgba(234,88,12,0.10)',
  need_reorder: '0 2px 10px rgba(180,83,9,0.12)',
  ok:           '0 1px 4px rgba(22,101,52,0.10)',
}

const STATUS_PRIORITY: Record<DisplayStatus, number> = {
  out: 0, low: 1, need_reorder: 2, need_count: 3, ok: 4,
}

// Category display order — superset of INVENTORY_CATEGORIES + purchase categories
const CATEGORY_ORDER: string[] = [
  ...INVENTORY_CATEGORIES,
  'Meat', 'Vegetables', 'Grocery', 'Beverage', 'Others',
]

// ── Item card ────────────────────────────────────────────────────────
function ItemCard({ item, onTap }: { item: InventoryView; onTap: () => void }) {
  const badge = STATUS_BADGE[item.displayStatus]
  return (
    <button
      type="button"
      onClick={onTap}
      className={`w-full text-left ${CARD_BG[item.displayStatus]} rounded-2xl p-4 active:brightness-95`}
      style={{ boxShadow: CARD_SHADOW[item.displayStatus] ?? '0 1px 3px rgba(0,0,0,0.06)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-900 truncate">{item.name}</div>
          {item.nameMs && (
            <div className="text-xs text-gray-400 mt-px truncate">{item.nameMs}</div>
          )}
          <div className="text-xs text-gray-600 mt-0.5 truncate">
            Stock: {item.currentQuantity} {item.unit}
            {item.trackOpened && item.openedQuantity > 0 && (
              <span className="text-gray-400">
                {' '}· Opened {item.openedQuantity} · Unopened {item.unopenedQuantity}
              </span>
            )}
            {item.location && (
              <span> · {item.location}</span>
            )}
          </div>
          {item.lastCountedAt && (
            <div className="text-xs text-gray-400 mt-0.5">
              Counted: {new Date(item.lastCountedAt).toLocaleDateString()}
            </div>
          )}
        </div>
        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full flex-shrink-0 ${badge.bgClass} ${badge.textClass}`}>
          {badge.label}
        </span>
      </div>
    </button>
  )
}

// ── Filter chip ───────────────────────────────────────────────────────
function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
        active
          ? 'bg-orange-500 text-white'
          : 'bg-white text-gray-600 border border-gray-200'
      }`}
    >
      {label}
    </button>
  )
}

// ── Page ─────────────────────────────────────────────────────────────
type StatusFilter = 'all' | 'low' | 'out' | 'need_reorder'
type OriginFilter = 'all' | 'local' | 'china'

const SUMMARY_ITEMS = [
  {
    key: 'all'          as StatusFilter,
    label: 'Total',
    activeBg: 'bg-gray-100',
    activeNum: 'text-gray-900',
    activeLbl: 'text-gray-600',
  },
  {
    key: 'low'          as StatusFilter,
    label: 'Low Stock',
    activeBg: 'bg-orange-100',
    activeNum: 'text-orange-600',
    activeLbl: 'text-orange-500',
  },
  {
    key: 'out'          as StatusFilter,
    label: 'Out',
    activeBg: 'bg-red-100',
    activeNum: 'text-red-600',
    activeLbl: 'text-red-500',
  },
  {
    key: 'need_reorder' as StatusFilter,
    label: 'Need Reorder',
    activeBg: 'bg-amber-100',
    activeNum: 'text-amber-700',
    activeLbl: 'text-amber-600',
  },
] as const

export default function InventoryPage() {
  const initCache = inventoryCache

  const [items, setItems] = useState<InventoryView[]>(initCache?.items ?? [])
  const [loading, setLoading] = useState(initCache === null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [originFilter, setOriginFilter] = useState<OriginFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    let active = true

    async function doFetch(isBackground: boolean) {
      const result = await fetchInventoryAction()
      if (!active) return

      if (result.ok) {
        const newItems = result.data
        const changed =
          !inventoryCache ||
          JSON.stringify(newItems) !== JSON.stringify(inventoryCache.items)
        if (changed) setItems(newItems)
        inventoryCache = { items: newItems, cachedAt: Date.now() }
        if (!isBackground) setLoading(false)
      } else {
        if (!isBackground) {
          setFetchError(result.error)
          setLoading(false)
        }
      }
    }

    if (initCache === null) {
      doFetch(false)
    } else {
      const isStale = Date.now() - initCache.cachedAt >= CACHE_TTL_MS
      if (isStale) doFetch(true)
    }

    return () => { active = false }
  }, [])

  const staff = useStaff()
  const role = staff?.role ?? ''

  const [countSheetOpen, setCountSheetOpen] = useState(false)
  const [countSheetCategory, setCountSheetCategory] = useState<string | undefined>(undefined)
  const [itemSheetOpen, setItemSheetOpen] = useState(false)
  const [itemSheetMode, setItemSheetMode] = useState<'add' | 'edit'>('add')
  const [editingItem, setEditingItem] = useState<InventoryView | undefined>(undefined)
  const [actionSheetOpen, setActionSheetOpen] = useState(false)
  const [actionSheetItem, setActionSheetItem] = useState<InventoryView | undefined>(undefined)
  const [countItemSheetOpen, setCountItemSheetOpen] = useState(false)
  const [countItemSheetItem, setCountItemSheetItem] = useState<InventoryView | undefined>(undefined)
  const [receiveSheetOpen, setReceiveSheetOpen] = useState(false)
  const [receiveSheetItem, setReceiveSheetItem] = useState<InventoryView | undefined>(undefined)

  function refreshItems() {
    fetchInventoryAction().then(result => {
      if (result.ok) {
        setItems(result.data)
        inventoryCache = { items: result.data, cachedAt: Date.now() }
      }
    })
  }

  function openAddItem() {
    setItemSheetMode('add')
    setEditingItem(undefined)
    setItemSheetOpen(true)
  }

  function openCountSheet(category?: string) {
    setCountSheetCategory(category)
    setCountSheetOpen(true)
  }

  function openActionSheet(item: InventoryView) {
    setActionSheetItem(item)
    setActionSheetOpen(true)
  }

  function handleActionSheetReceive() {
    setActionSheetOpen(false)
    setReceiveSheetItem(actionSheetItem)
    setReceiveSheetOpen(true)
  }

  function handleActionSheetCount() {
    setActionSheetOpen(false)
    setCountItemSheetItem(actionSheetItem)
    setCountItemSheetOpen(true)
  }

  function handleActionSheetEdit() {
    setActionSheetOpen(false)
    setItemSheetMode('edit')
    setEditingItem(actionSheetItem)
    setItemSheetOpen(true)
  }

  // Unfiltered counts for the summary strip (always reflect full inventory)
  const outCount     = items.filter(i => i.displayStatus === 'out').length
  const lowCount     = items.filter(i => i.displayStatus === 'low').length
  const reorderCount = items.filter(i => i.displayStatus === 'need_reorder').length

  // Derive available categories from actual items (extensible as new categories arrive)
  const availableCategories = useMemo(() => {
    const inItems = new Set(items.map(i => i.category))
    return CATEGORY_ORDER.filter(c => inItems.has(c))
      .concat([...inItems].filter(c => !CATEGORY_ORDER.includes(c)).sort())
  }, [items])

  // Combined filter pipeline
  const filteredItems = useMemo(() => {
    let result = items

    if (statusFilter !== 'all') {
      result = result.filter(i => i.displayStatus === statusFilter)
    }

    if (originFilter !== 'all') {
      result = result.filter(i =>
        originFilter === 'china'
          ? i.purchaseSource === 'china' || i.purchaseSource === 'both'
          : i.purchaseSource === 'local' || i.purchaseSource === 'both'
      )
    }

    if (categoryFilter) {
      result = result.filter(i => i.category === categoryFilter)
    }

    const q = searchQuery.trim().toLowerCase()
    if (q) {
      result = result.filter(i =>
        i.name.toLowerCase().includes(q) ||
        (i.nameMs?.toLowerCase().includes(q) ?? false) ||
        i.category.toLowerCase().includes(q) ||
        (i.supplier?.toLowerCase().includes(q) ?? false) ||
        (i.location?.toLowerCase().includes(q) ?? false)
      )
    }

    return result
  }, [items, statusFilter, originFilter, categoryFilter, searchQuery])

  // Items sorted by urgency then name — used for all list displays
  const sortedItems = useMemo(
    () => [...filteredItems].sort((a, b) => {
      const pd = STATUS_PRIORITY[a.displayStatus] - STATUS_PRIORITY[b.displayStatus]
      if (pd !== 0) return pd
      return a.name.localeCompare(b.name, 'zh')
    }),
    [filteredItems]
  )

  const anyFilterActive = statusFilter !== 'all' || originFilter !== 'all' || categoryFilter !== '' || searchQuery.trim() !== ''

  // Count Stock button visibility: role must have at least one countable category
  const hasCountableCategories = (CATEGORY_COUNT_PERMISSIONS[role]?.length ?? 0) > 0

  // "Count This Category" shortcut: shown when a specific category is selected and user can count it
  const showCountCategoryShortcut =
    categoryFilter !== '' &&
    filteredItems.length > 0 &&
    canCountCategory(role, categoryFilter)

  return (
    <PageTransition>
    <main className="bg-gray-50 w-full mx-auto min-h-screen pb-32 overflow-x-hidden">

      {/* ── Header ── */}
      <div className="bg-white px-4 py-3 flex items-center gap-3 border-b sticky top-0 z-10">
        <BackButton href="/" />
        <span className="font-semibold text-base flex-1">Inventory</span>
        {canManageInventory(role) && (
          <button
            type="button"
            onClick={openAddItem}
            aria-label="Add item"
            className="w-9 h-9 rounded-full bg-orange-500 text-white flex items-center justify-center text-xl leading-none shadow-md active:bg-orange-600"
          >
            +
          </button>
        )}
      </div>

      <div className="px-4 pt-4 space-y-3">

        {/* ── Summary strip ── */}
        <div className="bg-white rounded-2xl px-2 py-2 shadow-sm">
          <div className="grid grid-cols-4 gap-1">
            {SUMMARY_ITEMS.map(m => {
              const count = m.key === 'all' ? items.length
                : m.key === 'low' ? lowCount
                : m.key === 'out' ? outCount
                : reorderCount
              const active = statusFilter === m.key
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setStatusFilter(active ? 'all' : m.key)}
                  className={`flex flex-col items-center py-2.5 px-1 rounded-xl transition-colors min-h-[60px] justify-center ${
                    active ? m.activeBg : 'active:bg-gray-50'
                  }`}
                >
                  <div className={`text-xl font-bold leading-tight ${active ? m.activeNum : 'text-gray-400'}`}>
                    {count}
                  </div>
                  <div className={`text-xs mt-0.5 leading-tight text-center ${active ? m.activeLbl : 'text-gray-400'}`}>
                    {m.label}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Search ── */}
        <div className="relative">
          <input
            type="search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search name, category, supplier, location…"
            className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-400"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg leading-none w-6 h-6 flex items-center justify-center"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        {/* ── Filter groups ── */}
        <div className="space-y-2">
          {/* Origin */}
          <div
            className="flex gap-2 overflow-x-auto -mx-4 px-4"
            style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
          >
            <FilterChip label="All" active={originFilter === 'all'} onClick={() => setOriginFilter('all')} />
            <FilterChip label="Local" active={originFilter === 'local'} onClick={() => setOriginFilter(originFilter === 'local' ? 'all' : 'local')} />
            <FilterChip label="Imported" active={originFilter === 'china'} onClick={() => setOriginFilter(originFilter === 'china' ? 'all' : 'china')} />
          </div>

          {/* Category */}
          <div
            className="flex gap-2 overflow-x-auto -mx-4 px-4"
            style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
          >
            <FilterChip label="All" active={categoryFilter === ''} onClick={() => setCategoryFilter('')} />
            {availableCategories.map(cat => (
              <FilterChip
                key={cat}
                label={cat}
                active={categoryFilter === cat}
                onClick={() => setCategoryFilter(categoryFilter === cat ? '' : cat)}
              />
            ))}
          </div>
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="text-center py-16 text-sm text-gray-400">Loading...</div>
        ) : fetchError ? (
          <div className="bg-red-50 rounded-2xl p-4 text-sm text-red-500">{fetchError}</div>
        ) : (
          <div className="space-y-2 pb-4">
            {/* Count This Category shortcut */}
            {showCountCategoryShortcut && (
              <button
                type="button"
                onClick={() => openCountSheet(categoryFilter)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-white rounded-xl border border-orange-200 text-orange-600 text-sm font-medium mb-1"
              >
                <span>Count {categoryFilter}</span>
                <span className="text-orange-300 text-base">›</span>
              </button>
            )}

            {sortedItems.length === 0 ? (
              <div className="text-center py-16 text-sm text-gray-400">
                {anyFilterActive ? 'No items match these filters' : 'No inventory items'}
              </div>
            ) : (
              sortedItems.map(item => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onTap={() => openActionSheet(item)}
                />
              ))
            )}
          </div>
        )}

      </div>
    </main>

    {/* Floating Count Stock button */}
    {hasCountableCategories && (
      <button
        type="button"
        onClick={() => openCountSheet(undefined)}
        className="fixed bottom-24 right-4 z-50 bg-orange-500 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-lg active:bg-orange-600 transition-colors"
      >
        Count Stock
      </button>
    )}

    <CountSheet
      isOpen={countSheetOpen}
      role={role}
      initialCategory={countSheetCategory}
      onClose={() => setCountSheetOpen(false)}
      onSaved={refreshItems}
    />

    <ItemSheet
      mode={itemSheetMode}
      item={editingItem}
      isOpen={itemSheetOpen}
      onClose={() => setItemSheetOpen(false)}
      onSaved={refreshItems}
    />

    <ItemActionSheet
      item={actionSheetItem}
      isOpen={actionSheetOpen}
      role={role}
      onClose={() => setActionSheetOpen(false)}
      onReceiveStock={handleActionSheetReceive}
      onCountStock={handleActionSheetCount}
      onEditItem={handleActionSheetEdit}
      onSaved={refreshItems}
    />

    <ReceiveStockSheet
      item={receiveSheetItem}
      isOpen={receiveSheetOpen}
      onClose={() => setReceiveSheetOpen(false)}
      onSaved={refreshItems}
    />

    <CountItemSheet
      item={countItemSheetItem}
      isOpen={countItemSheetOpen}
      onClose={() => setCountItemSheetOpen(false)}
      onSaved={refreshItems}
    />

    </PageTransition>
  )
}
