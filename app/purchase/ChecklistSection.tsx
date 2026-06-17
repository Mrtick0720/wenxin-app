'use client'

import { useState, useEffect, useRef } from 'react'
import { PURCHASE_CATEGORIES, categoryColor } from '@/lib/purchaseLedger/categories'
import CatalogCombobox from './CatalogCombobox'
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

function rm(n: number) {
  return `RM ${n.toFixed(2)}`
}

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
      style={{ background: 'rgba(0,0,0,0.4)', paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 56px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl flex flex-col"
        style={{ maxHeight: 'calc(90vh - env(safe-area-inset-bottom,0px) - 56px)' }}
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
          className="flex-shrink-0 border-t border-gray-100 px-4 pt-3"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 12px)' }}
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

// ── Completion sheet (owner/manager only) ─────────────────────────────────────
function CompletionSheet({
  item, saving, error, onSave, onClose,
}: {
  item: ChecklistEntry
  saving: boolean
  error: string | null
  onSave: (unitPrice: number, supplier: string) => void
  onClose: () => void
}) {
  const [price, setPrice] = useState(item.unit_price != null ? String(item.unit_price) : '')
  const [supplier, setSupplier] = useState('')

  const qty = item.quantity
  const up = parseFloat(price) || 0
  const total = qty * up

  return (
    <div
      className="fixed inset-0 z-[420] flex flex-col justify-end"
      style={{ background: 'rgba(0,0,0,0.5)', paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 56px)' }}
      onClick={onClose}
    >
      <div className="bg-white rounded-t-3xl" onClick={e => e.stopPropagation()}>
        <div className="px-4 pt-5 pb-3 border-b border-gray-100">
          <div className="font-semibold text-base">Mark as Purchased</div>
          <div className="text-sm text-gray-500 mt-0.5">
            {item.name} · {qty % 1 === 0 ? qty.toFixed(0) : qty.toFixed(2)} {item.unit}
          </div>
        </div>

        <div className="px-4 pt-4 pb-3 space-y-3">
          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>
          )}

          <Field label="Unit Price (RM) *">
            <input
              autoFocus
              className={inputCls}
              style={{ fontSize: 24, fontWeight: 600 }}
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={price}
              onChange={e => setPrice(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && price) onSave(parseFloat(price), supplier) }}
            />
          </Field>

          {qty > 0 && up > 0 && (
            <div className="flex items-center justify-between px-1 text-sm">
              <span className="text-gray-400">
                {qty % 1 === 0 ? qty.toFixed(0) : qty.toFixed(2)} {item.unit} × {rm(up)}
              </span>
              <span className="font-semibold text-gray-900">{rm(total)}</span>
            </div>
          )}

          <Field label="Supplier (optional)">
            <input
              className={inputCls}
              style={{ fontSize: 16 }}
              placeholder="e.g. KK Meat Supply"
              value={supplier}
              onChange={e => setSupplier(e.target.value)}
            />
          </Field>
        </div>

        <div
          className="border-t border-gray-100 px-4 pt-3"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 12px)' }}
        >
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={onClose}
              className="py-3 rounded-2xl text-sm font-semibold bg-gray-100 text-gray-600 active:opacity-80">
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || !price || parseFloat(price) <= 0}
              onClick={() => onSave(parseFloat(price), supplier)}
              className="py-3 rounded-2xl text-sm font-semibold text-white active:opacity-90"
              style={{ background: price && parseFloat(price) > 0 && !saving ? '#22c55e' : '#d1d5db' }}
            >
              {saving ? 'Saving…' : 'Mark as Purchased'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

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
function CheckRow({
  item, canComplete, showCosts,
  onComplete, onUncomplete, onEdit, onDelete,
}: {
  item: ChecklistEntry
  canComplete: boolean
  showCosts: boolean
  onComplete: (item: ChecklistEntry) => void
  onUncomplete: (item: ChecklistEntry) => void
  onEdit: (item: ChecklistEntry) => void
  onDelete: (item: ChecklistEntry) => void
}) {
  const done = item.status === 'done'
  const categoryClr = categoryColor(item.category)
  const qtyStr = item.quantity % 1 === 0 ? item.quantity.toFixed(0) : item.quantity.toFixed(2)
  const up = item.unit_price ?? null
  const total = up !== null ? item.quantity * up : null

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

  // Kitchen: simple flex row, no prices, no swipe
  if (!showCosts) {
    return (
      <div style={{ position: 'relative', background: '#fff' }} className="border-b border-gray-50 last:border-0">
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: categoryClr }} />
        <div className="flex items-center gap-3 px-4 py-3">
          <Checkbox
            done={done}
            canAct={canComplete}
            onClick={() => done ? onUncomplete(item) : onComplete(item)}
          />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm" style={{ color: done ? '#9ca3af' : '#111827', textDecoration: done ? 'line-through' : 'none' }}>
              {item.name}
            </div>
            <div className="text-xs text-gray-400 mt-0.5 tabular-nums">{qtyStr} {item.unit}</div>
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
        {/* Grid — identical spec to RecordRow for cross-section column alignment */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '40px 1.1fr 0.7fr 1.2fr 1fr',
          alignItems: 'center',
          minHeight: 56,
          padding: '0 12px',
          gap: 4,
        }}>
          {/* Col 0: Checkbox — 40px fixed, centers the 24px circle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Checkbox
              done={done}
              canAct={canComplete}
              onClick={() => done ? onUncomplete(item) : onComplete(item)}
            />
          </div>
          {/* Col 1: Item name */}
          <span className="font-semibold text-gray-900 block truncate" style={{ minWidth: 0, fontSize: 16, color: done ? '#9ca3af' : undefined, textDecoration: done ? 'line-through' : 'none' }}>
            {item.name}
          </span>
          {/* Col 2: Qty + unit */}
          <span className="font-medium text-gray-600 block truncate tabular-nums" style={{ minWidth: 0, fontSize: 13 }}>
            {qtyStr} {item.unit}
          </span>
          {/* Col 3: Unit price */}
          <span className="font-medium text-gray-600 block truncate tabular-nums" style={{ minWidth: 0, fontSize: 13 }}>
            {up !== null
              ? `RM${up % 1 === 0 ? up.toFixed(0) : up.toFixed(2)}/${item.unit}`
              : <span className="text-gray-300">—</span>}
          </span>
          {/* Col 4: Total — right-aligned */}
          <span className="tabular-nums text-right block" style={{ minWidth: 0, fontSize: 14 }}>
            {total !== null
              ? <span className="font-semibold text-gray-900">{`RM ${total.toFixed(2)}`}</span>
              : <span className="text-gray-300">—</span>}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Main ChecklistSection ─────────────────────────────────────────────────────
export default function ChecklistSection({
  showCosts,
  catalog,
  catalogLoading,
  onRecordCreated,
  refreshKey = 0,
}: {
  showCosts: boolean
  catalog: CatalogItem[]
  catalogLoading: boolean
  onRecordCreated: () => void
  refreshKey?: number
}) {
  const [items, setItems] = useState<ChecklistEntry[]>([])
  const [loading, setLoading] = useState(true)

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
  const [completionSaving, setCompletionSaving] = useState(false)
  const [completionError, setCompletionError] = useState<string | null>(null)

  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  useEffect(() => {
    setLoading(true)
    fetchChecklistAction().then(res => {
      if (res.ok) setItems(res.data)
      setLoading(false)
    })
  }, [refreshKey])

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
      unit_price: addForm.unit_price ? parseFloat(addForm.unit_price) : null,
      note: addForm.note || null,
    })
    setAddSaving(false)
    if (!res.ok) { setAddError(res.error); return }
    setItems(prev => [res.data, ...prev])
    setAddForm(emptyAddForm); setAddCatalogItem(null); setShowAdd(false)
    showToast('Added to checklist')
  }

  // ── Edit ───────────────────────────────────────────────────────────────────
  function openEdit(item: ChecklistEntry) {
    setEditingItem(item)
    setEditForm({ name: item.name, category: item.category, unit: item.unit, quantity: String(item.quantity), unit_price: item.unit_price != null ? String(item.unit_price) : '', note: item.note ?? '' })
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
      unit_price: editForm.unit_price ? parseFloat(editForm.unit_price) : null,
      note: editForm.note || null,
    })
    setEditSaving(false)
    if (!res.ok) { setEditError(res.error); return }
    setItems(prev => prev.map(i => i.id === editingItem.id ? res.data : i))
    setEditingItem(null)
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function handleDelete(item: ChecklistEntry) {
    const res = await deleteChecklistItemAction(item.id)
    if (res.ok) {
      setItems(prev => prev.filter(i => i.id !== item.id))
      showToast(`${item.name} removed`)
    }
  }

  // ── Complete ───────────────────────────────────────────────────────────────
  async function handleComplete(unitPrice: number, supplier: string) {
    if (!completingItem) return
    setCompletionSaving(true); setCompletionError(null)
    const res = await completeChecklistItemAction(completingItem.id, {
      unit_price: unitPrice,
      supplier: supplier.trim() || null,
    })
    setCompletionSaving(false)
    if (!res.ok) { setCompletionError(res.error); return }
    const name = completingItem.name
    setItems(prev => prev.map(i =>
      i.id === completingItem.id
        ? { ...i, status: 'done' as const, purchase_record_id: res.data.purchaseRecordId, completed_at: new Date().toISOString() }
        : i,
    ))
    setCompletingItem(null)
    onRecordCreated()
    showToast(`${name} → Purchase Record created`)
  }

  // ── Uncomplete (revert done → pending, delete linked purchase record) ─────────
  async function handleUncomplete(item: ChecklistEntry) {
    const res = await uncompleteChecklistItemAction(item.id)
    if (!res.ok) { showToast('Failed to revert'); return }
    setItems(prev => prev.map(i => i.id === item.id ? res.data : i))
    onRecordCreated()
    showToast(`${item.name} moved back to Checklist`)
  }

  const pending = items.filter(i => i.status === 'pending')

  return (
    <div className="px-4 pt-4">
      {/* Section header */}
      <div className="flex items-center justify-between px-1 mb-2">
        <span className="text-xs font-semibold text-gray-500">Today&apos;s Purchase Checklist</span>
        <button
          type="button"
          onClick={() => { setAddForm(emptyAddForm); setAddCatalogItem(null); setAddError(null); setShowAdd(true) }}
          aria-label="Add checklist item"
          className="w-7 h-7 rounded-full flex items-center justify-center active:opacity-80"
          style={{ background: '#f97316' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm px-4 py-6 text-center text-gray-400 text-sm">Loading…</div>
      ) : pending.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm px-4 py-8 text-center text-gray-400 text-sm">
          No items — tap + to add a purchase request.
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {pending.map(item => (
            <CheckRow
              key={item.id}
              item={item}
              canComplete={showCosts}
              showCosts={showCosts}
              onComplete={item => { setCompletionError(null); setCompletingItem(item) }}
              onUncomplete={handleUncomplete}
              onEdit={openEdit}
              onDelete={handleDelete}
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

      {/* Completion sheet */}
      {completingItem && (
        <CompletionSheet
          item={completingItem}
          saving={completionSaving}
          error={completionError}
          onSave={handleComplete}
          onClose={() => setCompletingItem(null)}
        />
      )}
    </div>
  )
}
