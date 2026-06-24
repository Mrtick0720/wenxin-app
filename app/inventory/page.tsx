'use client'

import { useState, useEffect } from 'react'
import BackButton from '../components/BackButton'
import PageTransition from '../components/PageTransition'
import { fetchInventoryAction } from './actions'
import { INVENTORY_CATEGORIES } from '@/lib/inventory/status'
import type { InventoryView } from '@/lib/inventory/types'
import type { DisplayStatus } from '@/lib/inventory/types'
import { useStaff } from '../components/StaffProvider'
import { CATEGORY_COUNT_PERMISSIONS, canCountCategory } from '@/lib/inventory/permissions'
import CountSheet from './CountSheet'
import { canManageInventory } from '@/lib/inventory/permissions'
import ItemSheet from './ItemSheet'

// ── Status badge config ──────────────────────────────────────────────
const STATUS_BADGE: Record<DisplayStatus, { label: string; color: string }> = {
  out:          { label: 'Out of Stock',  color: 'bg-red-100 text-red-600' },
  low:          { label: 'Low Stock',     color: 'bg-orange-100 text-orange-600' },
  need_reorder: { label: 'Need Reorder',  color: 'bg-amber-100 text-amber-700' },
  need_count:   { label: 'Need Count',    color: 'bg-gray-100 text-gray-500' },
  ok:           { label: 'OK',            color: 'bg-green-100 text-green-600' },
}

const ATTENTION_ORDER: DisplayStatus[] = ['out', 'low', 'need_reorder', 'need_count']

const SECTION_LABEL: Record<DisplayStatus, string> = {
  out:          'Out of Stock',
  low:          'Low Stock',
  need_reorder: 'Need Reorder',
  need_count:   'Need Count',
  ok:           '',
}

const SECTION_COLOR: Record<DisplayStatus, string> = {
  out:          'text-red-500',
  low:          'text-orange-500',
  need_reorder: 'text-amber-700',
  need_count:   'text-gray-400',
  ok:           '',
}

// ── Standard card ────────────────────────────────────────────────────
function StandardCard({ item, onEdit }: { item: InventoryView; onEdit?: () => void }) {
  const badge = STATUS_BADGE[item.displayStatus]
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-900 truncate">{item.name}</div>
        <div className="text-xs text-gray-400 mt-0.5">
          Stock: {item.currentQuantity} {item.unit}
          {item.location && (
            <span className="ml-2">· {item.location}</span>
          )}
        </div>
        {item.lastCountedAt && (
          <div className="text-xs text-gray-300 mt-0.5">
            Counted: {new Date(item.lastCountedAt).toLocaleDateString()}
          </div>
        )}
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="text-xs text-gray-400 hover:text-orange-500 mt-1.5"
          >
            Edit
          </button>
        )}
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium ${badge.color}`}>
        {badge.label}
      </span>
    </div>
  )
}

// ── Sauce card ───────────────────────────────────────────────────────
function SauceCard({ item, onEdit }: { item: InventoryView; onEdit?: () => void }) {
  const badge = STATUS_BADGE[item.displayStatus]
  const showReorderWarning =
    item.reorderPoint != null && item.currentQuantity <= item.reorderPoint

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-900 truncate">{item.name}</div>
          <div className="text-xs text-gray-500 mt-0.5">
            Stock: {item.currentQuantity} {item.unit}
            {(item.openedQuantity > 0 || item.unopenedQuantity > 0) && (
              <span className="text-gray-400">
                {' '}· Opened {item.openedQuantity} · Unopened {item.unopenedQuantity}
              </span>
            )}
          </div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium ${badge.color}`}>
          {badge.label}
        </span>
      </div>

      {showReorderWarning && (
        <div className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5">
          Reorder at {item.reorderPoint} {item.unit}
          {item.leadTimeDays != null && ` · Lead time ${item.leadTimeDays} days`}
        </div>
      )}

      {item.onOrderQuantity > 0 && (
        <div className="text-xs text-blue-600">
          On order: {item.onOrderQuantity} {item.unit}
        </div>
      )}

      {(item.location || item.supplier) && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {item.location && (
            <span className="text-xs text-gray-400">Location: {item.location}</span>
          )}
          {item.supplier && (
            <span className="text-xs text-gray-400">Supplier: {item.supplier}</span>
          )}
        </div>
      )}

      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="text-xs text-gray-400 hover:text-orange-500"
        >
          Edit
        </button>
      )}
    </div>
  )
}

// ── Card dispatcher ──────────────────────────────────────────────────
function ItemCard({ item, onEdit }: { item: InventoryView; onEdit?: () => void }) {
  return item.category === 'Sauces'
    ? <SauceCard item={item} onEdit={onEdit} />
    : <StandardCard item={item} onEdit={onEdit} />
}

// ── Page ─────────────────────────────────────────────────────────────
type Tab = 'Attention' | 'All' | typeof INVENTORY_CATEGORIES[number]

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryView[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('Attention')

  useEffect(() => {
    fetchInventoryAction().then(result => {
      if (result.ok) setItems(result.data)
      else setFetchError(result.error)
      setLoading(false)
    })
  }, [])

  // Count Sheet state
  const staff = useStaff()
  const role = staff?.role ?? ''

  const [countSheetOpen, setCountSheetOpen] = useState(false)
  const [countSheetCategory, setCountSheetCategory] = useState<string | undefined>(undefined)

  const [itemSheetOpen, setItemSheetOpen] = useState(false)
  const [itemSheetMode, setItemSheetMode] = useState<'add' | 'edit'>('add')
  const [editingItem, setEditingItem] = useState<InventoryView | undefined>(undefined)

  function handleItemSaved() {
    setLoading(true)
    fetchInventoryAction().then(result => {
      if (result.ok) setItems(result.data)
      else setFetchError(result.error)
      setLoading(false)
    })
  }

  function openAddItem() {
    setItemSheetMode('add')
    setEditingItem(undefined)
    setItemSheetOpen(true)
  }

  function openEditItem(itemToEdit: InventoryView) {
    setItemSheetMode('edit')
    setEditingItem(itemToEdit)
    setItemSheetOpen(true)
  }

  function openCountSheet(category?: string) {
    setCountSheetCategory(category)
    setCountSheetOpen(true)
  }

  function handleCountSaved() {
    setLoading(true)
    fetchInventoryAction().then(result => {
      if (result.ok) setItems(result.data)
      else setFetchError(result.error)
      setLoading(false)
    })
  }

  // Summary counts
  const outCount     = items.filter(i => i.displayStatus === 'out').length
  const lowCount     = items.filter(i => i.displayStatus === 'low').length
  const reorderCount = items.filter(i => i.displayStatus === 'need_reorder').length
  const actionCount  = outCount + lowCount + reorderCount

  // Filtered list for the active tab
  const tabItems =
    activeTab === 'Attention' ? items.filter(i => i.displayStatus !== 'ok') :
    activeTab === 'All'       ? items :
    items.filter(i => i.category === activeTab)

  // Attention grouped by status priority
  const attentionGroups = ATTENTION_ORDER
    .map(status => ({ status, items: tabItems.filter(i => i.displayStatus === status) }))
    .filter(g => g.items.length > 0)

  const tabs: Tab[] = ['Attention', 'All', ...INVENTORY_CATEGORIES]

  return (
    <PageTransition>
    <main className="bg-gray-50 w-full mx-auto min-h-screen pb-32">

      {/* ── Header ── */}
      <div className="bg-white px-4 py-3 flex items-center gap-3 border-b sticky top-0 z-10">
        <BackButton href="/" />
        <span className="font-semibold text-base flex-1">Inventory</span>
        {canManageInventory(role) && (
          <button
            type="button"
            onClick={openAddItem}
            className="text-orange-500 text-sm font-medium"
          >
            + Add
          </button>
        )}
      </div>

      <div className="px-4 pt-4 space-y-4">

        {/* ── Summary strip ── */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <div className="text-xl font-bold text-gray-900">{items.length}</div>
              <div className="text-xs text-gray-400 mt-0.5">Total</div>
            </div>
            <div>
              <div className="text-xl font-bold text-orange-500">{lowCount}</div>
              <div className="text-xs text-gray-400 mt-0.5">Low Stock</div>
            </div>
            <div>
              <div className="text-xl font-bold text-red-500">{outCount}</div>
              <div className="text-xs text-gray-400 mt-0.5">Out of Stock</div>
            </div>
            <div>
              <div className="text-xl font-bold text-amber-600">{reorderCount}</div>
              <div className="text-xs text-gray-400 mt-0.5">Need Reorder</div>
            </div>
          </div>
        </div>

        {/* ── Tab chips ── */}
        <div
          className="flex gap-2 overflow-x-auto -mx-4 px-4"
          style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        >
          {tabs.map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              {tab}{tab === 'Attention' && actionCount > 0 ? ` ${actionCount}` : ''}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="text-center py-16 text-sm text-gray-400">Loading...</div>
        ) : fetchError ? (
          <div className="bg-red-50 rounded-2xl p-4 text-sm text-red-500">{fetchError}</div>
        ) : activeTab === 'Attention' ? (
          attentionGroups.length === 0 ? (
            <div className="text-center py-16 text-sm text-gray-400">
              All inventory looks OK
            </div>
          ) : (
            <div className="space-y-5 pb-4">
              {attentionGroups.map(group => (
                <div key={group.status}>
                  <div className={`text-xs font-semibold mb-2 px-1 uppercase tracking-wide ${SECTION_COLOR[group.status]}`}>
                    {SECTION_LABEL[group.status]}
                  </div>
                  <div className="space-y-2">
                    {group.items.map(item => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        onEdit={canManageInventory(role) ? () => openEditItem(item) : undefined}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="space-y-2 pb-4">
            {/* Count This Category shortcut — only for real category tabs, not Attention/All */}
            {activeTab !== 'All' && tabItems.length > 0 && canCountCategory(role, activeTab) && (
              <button
                type="button"
                onClick={() => openCountSheet(activeTab)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-white rounded-xl border border-orange-200 text-orange-600 text-sm font-medium mb-1"
              >
                <span>Count {activeTab}</span>
                <span className="text-orange-300 text-base">›</span>
              </button>
            )}
            {tabItems.length === 0 ? (
              <div className="text-center py-16 text-sm text-gray-400">
                No items in this category
              </div>
            ) : (
              tabItems.map(item => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onEdit={canManageInventory(role) ? () => openEditItem(item) : undefined}
                />
              ))
            )}
          </div>
        )}

      </div>
    </main>

    {/* Floating Count Stock button — shown for any role with at least one countable category */}
    {(CATEGORY_COUNT_PERMISSIONS[role]?.length ?? 0) > 0 && (
      <button
        type="button"
        onClick={() => openCountSheet(undefined)}
        className="fixed bottom-24 right-4 z-50 bg-orange-500 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-lg active:bg-orange-600 transition-colors"
      >
        Count Stock
      </button>
    )}

    {/* Count Sheet overlay */}
    <CountSheet
      isOpen={countSheetOpen}
      role={role}
      initialCategory={countSheetCategory}
      onClose={() => setCountSheetOpen(false)}
      onSaved={handleCountSaved}
    />

    <ItemSheet
      mode={itemSheetMode}
      item={editingItem}
      isOpen={itemSheetOpen}
      onClose={() => setItemSheetOpen(false)}
      onSaved={handleItemSaved}
    />

    </PageTransition>
  )
}
