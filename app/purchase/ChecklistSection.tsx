'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { PurchaseRecord } from '@/lib/purchaseLedger/types'
import { PURCHASE_CATEGORIES, categoryColor } from '@/lib/purchaseLedger/categories'
import CatalogCombobox from './CatalogCombobox'
import NumericEditorSheet from './NumericEditorSheet'
import type { CatalogItem } from '@/lib/purchaseLedger/catalog'
import {
  fetchChecklistAction,
  addChecklistItemAction,
  editChecklistItemAction,
  deleteChecklistItemAction,
  completeChecklistItemAction,
  uncompleteChecklistItemAction,
} from './checklist-actions'
import type { ChecklistEntry } from './checklist-actions'

const UNITS = ['kg', 'g', 'pcs', 'pack', 'box', 'bottle', 'bag', 'tray', 'bundle', 'carton', 'pail', 'portion']

// ── Shared input styles ───────────────────────────────────────────────────────
const inputCls =
  'w-full border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-orange-400 bg-white'

// ── Native select (iOS/Android shows native picker) ───────────────────────────
function NativeSelect({
  label, value, options, onChange,
}: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-gray-400 mb-1 block">{label}</label>
      <select
        className={inputCls}
        style={{ fontSize: 16 }}
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-gray-400 mb-1 block">{label}</label>
      {children}
    </div>
  )
}

// ── Empty form defaults ───────────────────────────────────────────────────────
const emptyAddForm = { name: '', category: 'Vegetables', unit: 'kg', quantity: '', unit_price: '', note: '' }

// ── Add / Edit sheet (shared layout) ─────────────────────────────────────────
function ItemFormSheet({
  title, form, setForm, catalogItem, setCatalogItem,
  catalog, catalogLoading, saving, error,
  showCatalog, showCosts,
  onSave, onClose,
}: {
  title: string
  form: { name: string; category: string; unit: string; quantity: string; unit_price: string; note: string }
  setForm: React.Dispatch<React.SetStateAction<typeof emptyAddForm>>
  catalogItem: CatalogItem | null
  setCatalogItem: (item: CatalogItem | null) => void
  catalog: CatalogItem[]
  catalogLoading: boolean
  saving: boolean
  error: string | null
  showCatalog: boolean
  showCosts: boolean
  onSave: () => void
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-[400] flex flex-col justify-end"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl flex flex-col"
        style={{ maxHeight: '90vh', paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 12px)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 pt-5 pb-3 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
          <span className="font-semibold text-base">{title}</span>
          <button type="button" onClick={onClose} className="text-gray-400 text-2xl leading-none">×</button>
        </div>

        <div className="px-4 pt-4 pb-3 overflow-y-auto flex-1 min-h-0 space-y-3">
          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>
          )}

          <Field label="Item Name *">
            {showCatalog ? (
              <CatalogCombobox
                items={catalog}
                selectedItem={catalogItem}
                loading={catalogLoading}
                error={null}
                onSelect={item => {
                  setCatalogItem(item)
                  setForm(f => ({ ...f, name: item.name_zh, category: item.category, unit: item.unit }))
                }}
              />
            ) : (
              <input
                className={inputCls}
                style={{ fontSize: 16 }}
                placeholder="Item name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            )}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <NativeSelect
              label="Category"
              value={form.category}
              options={[...PURCHASE_CATEGORIES]}
              onChange={v => setForm(f => ({ ...f, category: v }))}
            />
            <NativeSelect
              label="Unit"
              value={form.unit}
              options={UNITS}
              onChange={v => setForm(f => ({ ...f, unit: v }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity *">
              <input
                className={inputCls}
                style={{ fontSize: 16 }}
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') onSave() }}
              />
            </Field>
            {showCosts && (
              <Field label="Unit Price (RM)">
                <input
                  className={inputCls}
                  style={{ fontSize: 16 }}
                  type="number"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={form.unit_price}
                  onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))}
                />
              </Field>
            )}
          </div>

          <Field label="Note (optional)">
            <input
              className={inputCls}
              style={{ fontSize: 16 }}
              placeholder="e.g. fresh only, no frozen"
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
            />
          </Field>
        </div>

        <div
          className="flex-shrink-0 border-t border-gray-100 px-4 pt-3 pb-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={onClose}
              className="py-3 rounded-2xl text-sm font-semibold bg-gray-100 text-gray-600 active:opacity-80">
              Cancel
            </button>
            <button type="button" onClick={onSave} disabled={saving}
              className="py-3 rounded-2xl text-sm font-semibold text-white active:opacity-90"
              style={{ background: saving ? '#d1d5db' : '#f97316' }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Completion sheet: now uses shared NumericEditorSheet ──
// The NumericEditorSheet provides the custom keypad, dual cards, and identical
// interaction pattern as the Purchase Records inline edit.

// ── Checkbox circle ───────────────────────────────────────────────────────────
function Checkbox({
  done, canAct, onClick,
}: { done: boolean; canAct: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!canAct}
      style={{
        WebkitAppearance: 'none',
        appearance: 'none',
        flexShrink: 0,
        width: 24,
        height: 24,
        minWidth: 24,
        minHeight: 24,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        cursor: canAct ? 'pointer' : 'default',
        opacity: !canAct ? 0.4 : 1,
        // Pending: white fill + slate border. Done: green fill, no border.
        background: done ? '#22c55e' : '#fff',
        border: done ? 'none' : '2px solid #94a3b8',
      }}
    >
      {done && (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </button>
  )
}

// ── Single checklist row — same 5-column grid as RecordRow, with swipe for pending ──
// ── Kitchen display name helper ──────────────────────────────────────────────
// Resolves the best translated name for kitchen staff.

const NORM = (v?: string | null): string =>
  (v ?? '').trim().toLowerCase().normalize('NFC')

function getKitchenDisplayName(
  item: ChecklistEntry,
  catalog: CatalogItem[],
  catalogLoading: boolean,
): { name: string; loading: boolean } {
  // Still loading — show a neutral placeholder, never Chinese.
  if (catalogLoading) {
    return { name: '...', loading: true }
  }
  // Catalog is empty (failed to load or not yet fetched).
  if (catalog.length === 0) {
    return { name: item.name || 'Unknown item', loading: false }
  }

  const target = NORM(item.name)
  const match = catalog.find(
    c => NORM(c.name_zh) === target ||
         NORM(c.name_ms) === target,
  )
  if (!match) {
    if (typeof window !== 'undefined') {
      console.warn('[kitchen-name] no catalog match for', item.id, item.name)
    }
    return { name: item.name || 'Unknown item', loading: false }
  }

  const translated = match.name_ms
  if (!translated) {
    if (typeof window !== 'undefined') {
      console.warn('[kitchen-name] no ms/en translation for', item.id, item.name)
    }
    return { name: item.name || 'Unknown item', loading: false }
  }
  return { name: translated, loading: false }
}

function CheckRow({
  item, canComplete, showCosts,
  onComplete, onUncomplete, onEdit, onDelete,
  catalog, catalogLoading,
}: {
  item: ChecklistEntry
  canComplete: boolean
  showCosts: boolean
  onComplete: (item: ChecklistEntry) => void
  onUncomplete: (item: ChecklistEntry) => void
  onEdit: (item: ChecklistEntry) => void
  onDelete: (item: ChecklistEntry) => void
  catalog: CatalogItem[]
  catalogLoading: boolean
}) {
  const done = item.status === 'done'
  const categoryClr = categoryColor(item.category)
  const qtyStr = item.quantity % 1 === 0 ? item.quantity.toFixed(0) : item.quantity.toFixed(2)

  const { name: displayNameKitchen, loading: catalogLoadingName } =
    getKitchenDisplayName(item, catalog, catalogLoading)

  // Swipe state (same pattern as RecordRow; only active for pending owner/manager rows)
  const [swiped, _setSwiped] = useState(false)
  const swipedRef    = useRef(false)
  const isSwipeGest  = useRef(false)
  const touchStartX  = useRef(0)
  const touchStartY  = useRef(0)

  function setSwiped(v: boolean) { swipedRef.current = v; _setSwiped(v) }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    isSwipeGest.current = false
  }

  function onTouchEnd(e: React.TouchEvent) {
    const dx = touchStartX.current - e.changedTouches[0].clientX
    const dy = Math.abs(touchStartY.current - e.changedTouches[0].clientY)
    if (Math.abs(dx) > 40 && dy < 35) {
      isSwipeGest.current = true
      setSwiped(dx > 0)
      setTimeout(() => { isSwipeGest.current = false }, 350)
    }
  }

  function handleRowTap() {
    if (isSwipeGest.current) return
    if (swipedRef.current) { setSwiped(false); return }
  }

  const canSwipe = !done && showCosts
  const ACTION_W = 96 // edit + delete buttons
  const translate = canSwipe && swiped ? -ACTION_W : 0

  // Kitchen: compact swipe row with Malay/English names, edit + delete actions, creator
  if (!showCosts) {
    const ACTION_W = 96 // edit + delete buttons
    const canSwipe = !done

    const translate = canSwipe && swiped ? -ACTION_W : 0

    return (
      <div style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid #f3f4f6', background: '#fff' }} className="last:border-b-0">
        {/* Category color strip */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: categoryClr, zIndex: 2, pointerEvents: 'none' }} />
        {/* Swipe action area */}
        {canSwipe && (
          <div style={{
            position: 'absolute', right: 0, top: 0, bottom: 0, width: ACTION_W,
            display: 'flex', alignItems: 'stretch', background: '#ef4444', zIndex: 0,
          }}>
            <button type="button"
              onClick={() => { setSwiped(false); onEdit(item) }}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button type="button"
              onClick={() => { setSwiped(false); onDelete(item) }}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid #f87171' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </button>
          </div>
        )}

        {/* Sliding content */}
        <div
          style={{ transform: `translateX(${translate}px)`, transition: 'transform 0.22s ease', background: '#fff', position: 'relative', zIndex: 1, width: '100%' }}
          onTouchStart={canSwipe ? onTouchStart : undefined}
          onTouchEnd={canSwipe ? onTouchEnd : undefined}
          onClick={canSwipe ? handleRowTap : undefined}
        >
          {/* Kitchen grid — 2-column: name | qty */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            alignItems: 'center',
            minHeight: 56,
            padding: '0 12px',
            gap: 16,
          }}>
            {/* Col 0: Item name — flexible, truncates with ellipsis */}
            <div className="font-medium overflow-hidden text-ellipsis whitespace-nowrap" style={{ minWidth: 0, fontSize: 14, color: done ? '#9ca3af' : catalogLoadingName ? '#d1d5db' : '#111827', textDecoration: done ? 'line-through' : 'none' }}>
              {displayNameKitchen}
            </div>
            {/* Col 1: Qty + unit */}
            <span className="font-medium text-gray-500 tabular-nums whitespace-nowrap text-left" style={{ fontSize: 13 }}>
              {qtyStr} {item.unit}
            </span>
          </div>
        </div>
      </div>
    )
  }

  // Owner/Manager: same 5-column grid as RecordRow, swipe reveals edit+delete for pending
  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid #f3f4f6', background: '#fff' }} className="last:border-b-0">
      {/* Category color strip — inner element avoids parent border-radius corner artifact */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: categoryClr, zIndex: 2, pointerEvents: 'none' }} />
      {/* Swipe action area — only for pending items */}
      {canSwipe && (
        <div style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: ACTION_W,
          display: 'flex', alignItems: 'stretch', background: '#ef4444', zIndex: 0,
        }}>
          <button type="button"
            onClick={() => { setSwiped(false); onEdit(item) }}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button type="button"
            onClick={() => { setSwiped(false); onDelete(item) }}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid #f87171' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        </div>
      )}

      {/* Sliding content — sits above action area via z-index: 1 */}
      <div
        style={{ transform: `translateX(${translate}px)`, transition: 'transform 0.22s ease', background: '#fff', position: 'relative', zIndex: 1, width: '100%' }}
        onTouchStart={canSwipe ? onTouchStart : undefined}
        onTouchEnd={canSwipe ? onTouchEnd : undefined}
        onClick={canSwipe ? handleRowTap : undefined}
      >
        {/* Checklist grid — fixed columns: checkbox | name | qty | creator */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '40px minmax(0, 1fr) 72px 96px',
          alignItems: 'center',
          minHeight: 56,
          padding: '0 12px',
          gap: 12,
        }}>
          {/* Col 0: Checkbox */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Checkbox
              done={done}
              canAct={canComplete}
              onClick={() => done ? onUncomplete(item) : onComplete(item)}
            />
          </div>
          {/* Col 1: Item name — gets remaining space */}
          <div className="font-semibold text-gray-900 truncate" style={{ minWidth: 0, fontSize: 16, color: done ? '#9ca3af' : undefined, textDecoration: done ? 'line-through' : 'none' }}>
            {item.name}
          </div>
          {/* Col 2: Qty + unit — fixed width, left-aligned, nowrap */}
          <span className="font-medium text-gray-500 tabular-nums whitespace-nowrap text-left" style={{ fontSize: 13 }}>
            {qtyStr} {item.unit}
          </span>
          {/* Col 3: Creator name — fixed width, left-aligned, truncated */}
          <span className="font-medium text-gray-500 truncate text-left" style={{ fontSize: 13 }}>
            {item.created_by_name || '—'}
          </span>
        </div>
      </div>
    </div>
  )
}

export type RestoreChecklistAction =
  | { type: 'add'; item: ChecklistEntry }
  | { type: 'replace'; tempId: number; item: ChecklistEntry }
  | { type: 'remove'; id: number }

// ── Main ChecklistSection ─────────────────────────────────────────────────────
export default function ChecklistSection({
  showCosts,
  catalog,
  catalogLoading,
  onRecordCreated,
  onItemCompleting,
  onItemCompleted,
  onItemCompleteFailed,
  initialItems,
  refreshKey = 0,
  restoreItemRef,
  triggerAddRef,
  purchasedChecklistIds,
  updateItemsRef,
}: {
  showCosts: boolean
  catalog: CatalogItem[]
  catalogLoading: boolean
  onRecordCreated: () => void
  onItemCompleting?: (item: ChecklistEntry, completion: { unit_price: number; supplier: string | null }) => number
  onItemCompleted?: (record: PurchaseRecord, optimisticId?: number) => void
  onItemCompleteFailed?: (optimisticId?: number) => void
  initialItems?: ChecklistEntry[]
  refreshKey?: number
  restoreItemRef?: React.MutableRefObject<((action: RestoreChecklistAction) => void) | null>
  triggerAddRef?: React.MutableRefObject<(() => void) | null>
  purchasedChecklistIds?: Set<number>
  updateItemsRef?: React.MutableRefObject<((freshItems: ChecklistEntry[]) => void) | null>
}) {
  const [items, setItems] = useState<ChecklistEntry[]>(initialItems ?? [])
  const [loading, setLoading] = useState(!initialItems)

  // Add sheet
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState(emptyAddForm)
  const [addCatalogItem, setAddCatalogItem] = useState<CatalogItem | null>(null)
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // Edit sheet
  const [editingItem, setEditingItem] = useState<ChecklistEntry | null>(null)
  const [editForm, setEditForm] = useState(emptyAddForm)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Completion sheet
  const [completingItem, setCompletingItem] = useState<ChecklistEntry | null>(null)
  const pendingCompletes = useRef<Set<number>>(new Set())
  const pendingDeletes = useRef<Set<number>>(new Set())

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<ChecklistEntry | null>(null)

  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  // Skip the very first fetch if server-provided initialItems were passed in.
  // Subsequent refreshKey increments (from mutations) always re-fetch.
  const skipFirstFetch = useRef(!!initialItems)
  useEffect(() => {
    if (skipFirstFetch.current) { skipFirstFetch.current = false; return }
    setLoading(true)
    fetchChecklistAction().then(res => {
      if (res.ok) {
        // Don't restore items being optimistically removed (completion or delete in flight).
        // Without this guard, a concurrent refreshKey bump can undo an optimistic removal.
        setItems(prev => {
          const protected_ = new Set([...pendingCompletes.current, ...pendingDeletes.current])
          // Keep any temp-id items (negative IDs) that were added optimistically
          const tempItems = prev.filter(i => i.id < 0)
          const fresh = protected_.size > 0
            ? res.data.filter(i => !protected_.has(i.id))
            : res.data
          // Merge: fresh server items + any temp optimistic items not yet reconciled
          const tempNotInFresh = tempItems.filter(t => !fresh.some(f => f.id === t.id))
          return [...tempNotInFresh, ...fresh]
        })
      }
      setLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  // Expose restoreItem to parent via ref.
  // Supports:
  //   1. { type: 'add', item }        — add a new item (skips duplicates by id)
  //   2. { type: 'replace', tempId, item } — replace a temp-id item with a real one
  //   3. { type: 'remove', id }       — remove an item by id (e.g. rollback on failure)
  //
  // NOTE: No cleanup sets current = null, because the parent may call the ref
  // during the same render cycle (e.g. optimistic updates in handleUncheck).
  // A null ref would silently swallow those calls.
  useEffect(() => {
    if (restoreItemRef) {
      restoreItemRef.current = (action) => {
        if (action.type === 'replace') {
          setItems(prev => {
            const withoutTemp = prev.filter(i => i.id !== action.tempId)
            const deduped = withoutTemp.filter(i => i.id !== action.item.id)
            return [action.item, ...deduped]
          })
        } else if (action.type === 'remove') {
          setItems(prev => prev.filter(i => i.id !== action.id))
        } else {
          setItems(prev => {
            if (prev.some(i => i.id === action.item.id)) return prev
            return [action.item, ...prev]
          })
        }
      }
    }
  }, [restoreItemRef])

  // Expose openAdd to parent so the + button can live in the section header.
  useEffect(() => {
    if (triggerAddRef) {
      triggerAddRef.current = () => {
        setAddForm(emptyAddForm)
        setAddCatalogItem(null)
        setAddError(null)
        setShowAdd(true)
      }
    }
  }, [triggerAddRef])

  // Expose a direct items updater so the parent can push fresh server data
  // atomically (in the same React batch as records/KPI), eliminating the
  // sequential delay that would otherwise cause cross-device dual-display.
  useEffect(() => {
    if (updateItemsRef) {
      updateItemsRef.current = (freshItems: ChecklistEntry[]) => {
        setItems(prev => {
          const protected_ = new Set([...pendingCompletes.current, ...pendingDeletes.current])
          const tempItems = prev.filter(i => i.id < 0)
          const fresh = protected_.size > 0
            ? freshItems.filter(i => !protected_.has(i.id))
            : freshItems
          const tempNotInFresh = tempItems.filter(t => !fresh.some(f => f.id === t.id))
          return [...tempNotInFresh, ...fresh]
        })
      }
    }
  }, [updateItemsRef])

  // ── Add ────────────────────────────────────────────────────────────────────
  async function handleAdd() {
    const qty = parseFloat(addForm.quantity)
    if (!addForm.name.trim()) { setAddError('Item name is required.'); return }
    if (!qty || qty <= 0) { setAddError('Quantity must be greater than zero.'); return }
    setAddSaving(true); setAddError(null)
    const res = await addChecklistItemAction({
      name: addForm.name,
      category: addForm.category,
      unit: addForm.unit,
      quantity: qty,
      note: addForm.note || null,
    })
    setAddSaving(false)
    if (!res.ok) { setAddError(res.error); return }
    setItems(prev => [res.data, ...prev])
    setAddForm(emptyAddForm); setAddCatalogItem(null); setShowAdd(false)
  }

  // ── Edit ───────────────────────────────────────────────────────────────────
  function openEdit(item: ChecklistEntry) {
    setEditingItem(item)
    setEditForm({ name: item.name, category: item.category, unit: item.unit, quantity: String(item.quantity), unit_price: '', note: item.note ?? '' })
    setEditError(null)
  }

  async function handleEdit() {
    if (!editingItem) return
    const qty = parseFloat(editForm.quantity)
    if (!editForm.name.trim()) { setEditError('Item name is required.'); return }
    if (!qty || qty <= 0) { setEditError('Quantity must be greater than zero.'); return }
    setEditSaving(true); setEditError(null)
    const res = await editChecklistItemAction(editingItem.id, {
      name: editForm.name,
      category: editForm.category,
      unit: editForm.unit,
      quantity: qty,
      note: editForm.note || null,
    })
    setEditSaving(false)
    if (!res.ok) { setEditError(res.error); return }
    setItems(prev => prev.map(i => i.id === editingItem.id ? res.data : i))
    setEditingItem(null)
  }

  // ── Delete (with confirmation) ────────────────────────────────────────────
  function requestDelete(item: ChecklistEntry) {
    setDeleteTarget(item)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const item = deleteTarget
    setDeleteTarget(null)
    if (pendingDeletes.current.has(item.id)) return
    pendingDeletes.current.add(item.id)
    // Optimistic: remove immediately
    setItems(prev => prev.filter(i => i.id !== item.id))
    const res = await deleteChecklistItemAction(item.id)
    pendingDeletes.current.delete(item.id)
    if (!res.ok) {
      // Rollback: restore item in place
      setItems(prev => {
        if (prev.some(i => i.id === item.id)) return prev
        return [item, ...prev]
      })
      showToast('Delete failed')
    }
  }

  // ── Complete ───────────────────────────────────────────────────────────────
  // Wraps the existing completion logic to match NumericEditorSheet's onSave signature.
  const handleCompleteSave = useCallback(async (data: {
    quantity: number
    unitPrice: number
    supplier: string
  }): Promise<{ ok: boolean; error?: string }> => {
    if (!completingItem) return { ok: false, error: 'No item selected' }
    if (pendingCompletes.current.has(completingItem.id)) return { ok: false, error: 'Already in progress' }
    pendingCompletes.current.add(completingItem.id)

    // Optimistic: immediately remove from checklist before server responds
    const optimisticItem = completingItem
    const completion = { unit_price: data.unitPrice, supplier: data.supplier || null }
    const optimisticId = onItemCompleting?.(optimisticItem, completion)
    setItems(prev => prev.filter(i => i.id !== optimisticItem.id))
    setCompletingItem(null)

    const res = await completeChecklistItemAction(optimisticItem.id, completion)
    pendingCompletes.current.delete(optimisticItem.id)

    if (!res.ok) {
      // Rollback: put item back
      onItemCompleteFailed?.(optimisticId)
      setItems(prev => [optimisticItem, ...prev])
      setCompletingItem(optimisticItem)
      return { ok: false, error: res.error }
    }

    // Notify parent to replace the temporary record — no records refresh needed
    onItemCompleted?.(res.data.record, optimisticId)
    return { ok: true }
  }, [completingItem, onItemCompleting, onItemCompleted, onItemCompleteFailed])

  // ── Uncomplete (revert done → pending, delete linked purchase record) ─────────
  async function handleUncomplete(item: ChecklistEntry) {
    const res = await uncompleteChecklistItemAction(item.id)
    if (!res.ok) { showToast('Failed to revert'); return }
    setItems(prev => prev.map(i => i.id === item.id ? res.data : i))
    onRecordCreated()
  }

  // Only show truly pending items. Reconcile against purchase records by
  // checklist_item_id (passed from parent): if a record already references this
  // checklist item, it has been purchased — hide it here even if this device's
  // own checklist row hasn't yet been refetched with status='done'. This closes
  // the cross-device dual-display window. Temp optimistic items (id < 0) are
  // never matched since records carry only real positive checklist ids.
  const pending = items.filter(i =>
    i.status === 'pending' &&
    i.purchase_record_id === null &&
    !(purchasedChecklistIds?.has(i.id) ?? false)
  )

  return (
    <div>
      {loading && items.length === 0 ? (
        <div className="py-6 text-center text-gray-400 text-sm">Loading…</div>
      ) : pending.length === 0 ? (
        <div className="py-8 text-center text-gray-400 text-sm">
          No items — tap + to add a purchase request.
        </div>
      ) : (
        <div>
          {pending.map(item => (
            <CheckRow
              key={item.id}
              item={item}
              canComplete={showCosts}
              showCosts={showCosts}
              onComplete={item => { setCompletingItem(item) }}
              onUncomplete={handleUncomplete}
              onEdit={openEdit}
              onDelete={requestDelete}
              catalog={catalog}
              catalogLoading={catalogLoading}
            />
          ))}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className="fixed left-1/2 z-[600] -translate-x-1/2 px-5 py-2.5 rounded-full text-sm font-medium text-white shadow-lg pointer-events-none"
          style={{ bottom: 'calc(env(safe-area-inset-bottom,0px) + 72px)', background: '#111827' }}
        >
          {toast}
        </div>
      )}

      {/* Add sheet */}
      {showAdd && (
        <ItemFormSheet
          title="Add to Checklist"
          form={addForm}
          setForm={setAddForm}
          catalogItem={addCatalogItem}
          setCatalogItem={setAddCatalogItem}
          catalog={catalog}
          catalogLoading={catalogLoading}
          saving={addSaving}
          error={addError}
          showCatalog={true}
          showCosts={showCosts}
          onSave={handleAdd}
          onClose={() => setShowAdd(false)}
        />
      )}

      {/* Edit sheet */}
      {editingItem && (
        <ItemFormSheet
          title="Edit Item"
          form={editForm}
          setForm={setEditForm}
          catalogItem={null}
          setCatalogItem={() => {}}
          catalog={[]}
          catalogLoading={false}
          saving={editSaving}
          error={editError}
          showCatalog={false}
          showCosts={showCosts}
          onSave={handleEdit}
          onClose={() => setEditingItem(null)}
        />
      )}

      {/* Completion sheet — shared NumericEditorSheet with custom keypad */}
      {completingItem && (
        <NumericEditorSheet
          title="Mark as Purchased"
          itemName={completingItem.name}
          unit={completingItem.unit}
          initialQuantity={completingItem.quantity}
          initialUnitPrice={null}
          initialSupplier=""
          quantityEditable={false}
          showSupplier={true}
          onSave={handleCompleteSave}
          onClose={() => setCompletingItem(null)}
        />
      )}

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setDeleteTarget(null)}
        >
          <div className="bg-white rounded-2xl mx-6 p-5 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="text-base font-semibold text-gray-900">Delete Item</div>
              <div className="text-sm text-gray-500 mt-2">
                Remove <strong>{deleteTarget.name}</strong> from the checklist?
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button type="button" onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600 active:opacity-80">
                Cancel
              </button>
              <button type="button" onClick={confirmDelete}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white active:opacity-80"
                style={{ background: '#ef4444' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
