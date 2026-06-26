'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { PurchaseRecord } from '@/lib/purchaseLedger/types'
import { PURCHASE_CATEGORIES, categoryColor, categoryOrderIndex } from '@/lib/purchaseLedger/categories'
import CatalogCombobox from './CatalogCombobox'
import NumericEditorSheet from './NumericEditorSheet'
import {
  resolveCatalogDisplayName,
  type CatalogItem,
} from '@/lib/purchaseLedger/catalog'
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
const Z_MAX = 2147483647

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
const emptyAddForm = {
  name: '',
  specification: '',
  supplier: '',
  category: 'Vegetables',
  unit: 'kg',
  quantity: '',
  unit_price: '',
  note: '',
}

// ── Add / Edit sheet (shared layout) ─────────────────────────────────────────
function ItemFormSheet({
  title, form, setForm, catalogItem, setCatalogItem,
  catalog, catalogLoading, saving, error,
  showCatalog, showCosts, planningOnly = false,
  onSave, onClose, onDelete,
}: {
  title: string
  form: typeof emptyAddForm
  setForm: React.Dispatch<React.SetStateAction<typeof emptyAddForm>>
  catalogItem: CatalogItem | null
  setCatalogItem: (item: CatalogItem | null) => void
  catalog: CatalogItem[]
  catalogLoading: boolean
  saving: boolean
  error: string | null
  showCatalog: boolean
  showCosts: boolean
  planningOnly?: boolean
  onSave: () => void
  onClose: () => void
  onDelete?: () => void
}) {
  // Keyboard-aware height — keep sheet above the mobile keyboard
  const [kbHeight, setKbHeight] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    function update() {
      const kh = window.innerHeight - vv!.height
      setKbHeight(kh > 0 ? kh : 0)
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  const content = (
    <div
      className="fixed flex flex-col justify-end"
      style={{
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: Z_MAX,
        background: 'rgba(0,0,0,0.4)',
      }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl flex flex-col"
        style={{
          maxHeight: kbHeight > 0
            ? `calc(${window.innerHeight - kbHeight}px - 16px)`
            : '90vh',
          paddingBottom: kbHeight > 0 ? kbHeight : 'calc(env(safe-area-inset-bottom,0px) + 20px)',
        }}
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

          {!planningOnly && (
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
          )}

          <div className={planningOnly ? '' : 'grid grid-cols-2 gap-3'}>
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
            {!planningOnly && showCosts && (
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

          <Field label="Specification">
            <input
              className={inputCls}
              style={{ fontSize: 16 }}
              placeholder="e.g. large size, boneless"
              value={form.specification}
              onChange={e => setForm(f => ({ ...f, specification: e.target.value }))}
            />
          </Field>

          <Field label="Supplier">
            <input
              className={inputCls}
              style={{ fontSize: 16 }}
              placeholder="e.g. KK Fresh Market"
              value={form.supplier}
              onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))}
            />
          </Field>

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
          className="flex-shrink-0 border-t border-gray-100 px-4 pt-3 pb-3 space-y-2"
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
          {onDelete && (
            <button type="button" onClick={onDelete}
              className="w-full py-3 rounded-2xl text-sm font-semibold text-red-400 bg-red-50 active:opacity-80">
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(content, document.body)
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
    return { name: 'Unknown item', loading: false }
  }

  const name = resolveCatalogDisplayName(item.name, catalog, 'latin')
  if (name === 'Unknown item') {
    if (typeof window !== 'undefined') {
      console.warn('[kitchen-name] no catalog match for', item.id, item.name)
    }
  }
  return { name, loading: false }
}

function CheckRow({
  item, canComplete, showCosts,
  onComplete, onUncomplete, onEdit,
  catalog, catalogLoading,
  selectMode = false, selected = false, onToggleSelect,
}: {
  item: ChecklistEntry
  canComplete: boolean
  showCosts: boolean
  onComplete: (item: ChecklistEntry) => void
  onUncomplete: (item: ChecklistEntry) => void
  onEdit: (item: ChecklistEntry) => void
  catalog: CatalogItem[]
  catalogLoading: boolean
  selectMode?: boolean
  selected?: boolean
  onToggleSelect?: (id: number) => void
}) {
  const done = item.status === 'done'
  const categoryClr = categoryColor(item.category)
  const qtyStr = item.quantity % 1 === 0 ? item.quantity.toFixed(0) : item.quantity.toFixed(2)
  const planningDetails = [
    item.specification?.trim() || null,
    item.supplier?.trim() ? `Supplier: ${item.supplier.trim()}` : null,
  ].filter((value): value is string => Boolean(value))

  const { name: displayNameKitchen, loading: catalogLoadingName } =
    getKitchenDisplayName(item, catalog, catalogLoading)

  // Row swipe removed — it conflicted with the page-level stage carousel.
  // Owner/manager: tap the circle to purchase (qty/price editable in the sheet),
  // tap the row to edit; delete lives inside the purchase sheet. Kitchen: read-only.

  // Kitchen: compact read-only row with Malay/English names
  if (!showCosts) {
    return (
      <div style={{ position: 'relative', borderBottom: '1px solid #f3f4f6', background: '#fff' }} className="last:border-b-0">
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: categoryClr, zIndex: 2, pointerEvents: 'none' }} />
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          alignItems: 'center',
          minHeight: 56,
          padding: '0 12px',
          gap: 16,
        }}>
          <div className="min-w-0">
            <div className="font-medium overflow-hidden text-ellipsis whitespace-nowrap" style={{ fontSize: 14, color: done ? '#9ca3af' : catalogLoadingName ? '#d1d5db' : '#111827', textDecoration: done ? 'line-through' : 'none' }}>
              {displayNameKitchen}
            </div>
            {planningDetails.length > 0 && (
              <div className="mt-0.5 truncate text-[11px] text-gray-400">
                {planningDetails.join(' · ')}
              </div>
            )}
          </div>
          <span className="font-medium text-gray-500 tabular-nums whitespace-nowrap text-left" style={{ fontSize: 13 }}>
            {qtyStr} {item.unit}
          </span>
        </div>
      </div>
    )
  }

  // Select mode: tap whole row to toggle selection
  if (selectMode) {
    return (
      <div
        style={{ position: 'relative', borderBottom: '1px solid #f3f4f6', background: selected ? '#fff7ed' : '#fff' }}
        className="last:border-b-0 active:opacity-80"
        onClick={() => onToggleSelect?.(item.id)}
      >
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: categoryClr, zIndex: 2, pointerEvents: 'none' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '40px minmax(0, 2fr) minmax(0, 0.75fr) minmax(0, 1fr)', alignItems: 'center', minHeight: 56, padding: '0 12px', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{
              width: 22, height: 22, borderRadius: 11,
              border: `2px solid ${selected ? '#f97316' : '#d1d5db'}`,
              background: selected ? '#f97316' : '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {selected && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-gray-900 truncate" style={{ fontSize: 16 }}>{item.name}</div>
            {planningDetails.length > 0 && <div className="mt-0.5 truncate text-[11px] font-normal text-gray-400">{planningDetails.join(' · ')}</div>}
          </div>
          <span className="font-medium text-gray-500 tabular-nums whitespace-nowrap text-left" style={{ fontSize: 13 }}>{qtyStr} {item.unit}</span>
          <span className="font-medium text-gray-500 truncate text-left" style={{ fontSize: 13 }}>{item.created_by_name || '—'}</span>
        </div>
      </div>
    )
  }

  // Owner/Manager: tap circle → purchase sheet; tap row → edit
  return (
    <div
      style={{ position: 'relative', borderBottom: '1px solid #f3f4f6', background: '#fff' }}
      className="last:border-b-0 active:bg-gray-50"
      onClick={() => onEdit(item)}
    >
      {/* Category color strip */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: categoryClr, zIndex: 2, pointerEvents: 'none' }} />
      <div style={{
        display: 'grid',
        gridTemplateColumns: '40px minmax(0, 2fr) minmax(0, 0.75fr) minmax(0, 1fr)',
        alignItems: 'center',
        minHeight: 56,
        padding: '0 12px',
        gap: 12,
      }}>
        {/* Col 0: Checkbox — stop propagation so tapping the circle purchases, not edits */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
          <Checkbox
            done={done}
            canAct={canComplete}
            onClick={() => done ? onUncomplete(item) : onComplete(item)}
          />
        </div>
        {/* Col 1: Item name */}
        <div className="min-w-0">
          <div className="font-semibold text-gray-900 truncate" style={{ fontSize: 16, color: done ? '#9ca3af' : undefined, textDecoration: done ? 'line-through' : 'none' }}>
            {item.name}
          </div>
          {planningDetails.length > 0 && (
            <div className="mt-0.5 truncate text-[11px] font-normal text-gray-400">
              {planningDetails.join(' · ')}
            </div>
          )}
        </div>
        {/* Col 2: Qty + unit */}
        <span className="font-medium text-gray-500 tabular-nums whitespace-nowrap text-left" style={{ fontSize: 13 }}>
          {qtyStr} {item.unit}
        </span>
        {/* Col 3: Creator name */}
        <span className="font-medium text-gray-500 truncate text-left" style={{ fontSize: 13 }}>
          {item.created_by_name || '—'}
        </span>
      </div>
    </div>
  )
}

export type RestoreChecklistAction =
  | { type: 'add'; item: ChecklistEntry }
  | { type: 'replace'; tempId: number; item: ChecklistEntry }
  | { type: 'remove'; id: number }

// ── Send Sheet ────────────────────────────────────────────────────────────────
function resolveEnglishName(itemName: string, catalog: CatalogItem[]): string {
  const norm = (s: string) => s.trim().toLowerCase()
  const match = catalog.find(c => norm(c.name_zh) === norm(itemName))
  return match?.name_ms?.trim() || itemName
}

function formatSendText(items: ChecklistEntry[], catalog: CatalogItem[]): string {
  const today = new Date()
  const dd = String(today.getDate()).padStart(2, '0')
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const yyyy = today.getFullYear()
  const dateStr = `${dd}/${mm}/${yyyy}`
  const groups: Record<string, ChecklistEntry[]> = {}
  for (const item of items) {
    if (!groups[item.category]) groups[item.category] = []
    groups[item.category].push(item)
  }
  let text = `WENXIN PURCHASE ORDER\nDate: ${dateStr}\n`
  for (const [cat, catItems] of Object.entries(groups)) {
    text += `\n${cat.toUpperCase()}\n`
    for (const item of catItems) {
      const qty = item.quantity % 1 === 0 ? item.quantity.toFixed(0) : item.quantity.toFixed(2)
      const displayName = resolveEnglishName(item.name, catalog)
      text += `• ${displayName} – ${qty} ${item.unit}\n`
    }
  }
  text += '\nThank you.'
  return text
}

function SendSheet({
  items, purchaserName, catalog,
  onClose,
}: {
  items: ChecklistEntry[]
  purchaserName: string
  catalog: CatalogItem[]
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const text = formatSendText(items, catalog)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleCopy() {
    // Primary: Clipboard API (modern browsers)
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true)
        setTimeout(() => { setCopied(false); onClose() }, 1400)
      }).catch(() => fallbackCopy())
    } else {
      fallbackCopy()
    }
  }

  function fallbackCopy() {
    // Fallback: select textarea and execCommand (works on iOS Safari)
    const ta = textareaRef.current
    if (!ta) return
    ta.select()
    ta.setSelectionRange(0, 99999)
    try {
      document.execCommand('copy')
      setCopied(true)
      setTimeout(() => { setCopied(false); onClose() }, 1400)
    } catch {
      // last resort: show text for manual copy
    }
  }

  return typeof document !== 'undefined' ? createPortal(
    <div
      className="fixed flex flex-col justify-end"
      style={{ top: 0, left: 0, right: 0, bottom: 0, zIndex: Z_MAX, background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl flex flex-col"
        style={{ maxHeight: '80vh', paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 16px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <span className="text-base font-semibold text-gray-900">Order Preview</span>
          <button type="button" onClick={onClose} className="text-gray-400 active:opacity-60 text-2xl leading-none">×</button>
        </div>
        {/* Hidden textarea for fallback copy */}
        <textarea
          ref={textareaRef}
          readOnly
          value={text}
          style={{ position: 'absolute', left: -9999, top: -9999, opacity: 0, height: 1 }}
          aria-hidden
        />
        {/* Preview */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed bg-gray-50 rounded-2xl p-4">
            {text}
          </pre>
        </div>
        {/* Copy button */}
        <div className="px-5 pt-3">
          <button
            type="button"
            onClick={handleCopy}
            className="w-full py-3.5 rounded-2xl text-base font-semibold text-white active:opacity-80 transition-colors"
            style={{ background: copied ? '#16a34a' : '#f97316' }}
          >
            {copied ? '✓ Copied! Go paste & send' : 'Copy Order'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null
}

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
  triggerSendRef,
  triggerSelectAllRef,
  triggerCancelSelectRef,
  purchasedChecklistIds,
  updateItemsRef,
  cancelGuardsRef,
  onItemsChange,
  onSelectModeChange,
  onSelectionChange,
  purchaserName = '',
}: {
  showCosts: boolean
  catalog: CatalogItem[]
  catalogLoading: boolean
  onRecordCreated: () => void
  onItemCompleting?: (item: ChecklistEntry, completion: { unit_price: number; supplier: string | null; quantity: number }) => number
  onItemCompleted?: (record: PurchaseRecord, optimisticId?: number) => void
  onItemCompleteFailed?: (optimisticId?: number) => void
  initialItems?: ChecklistEntry[]
  refreshKey?: number
  restoreItemRef?: React.MutableRefObject<((action: RestoreChecklistAction) => void) | null>
  triggerAddRef?: React.MutableRefObject<(() => void) | null>
  triggerSendRef?: React.MutableRefObject<(() => void) | null>
  triggerSelectAllRef?: React.MutableRefObject<(() => void) | null>
  triggerCancelSelectRef?: React.MutableRefObject<(() => void) | null>
  purchasedChecklistIds?: Set<number>
  updateItemsRef?: React.MutableRefObject<((freshItems: ChecklistEntry[]) => void) | null>
  cancelGuardsRef?: React.MutableRefObject<Set<number>>
  onItemsChange?: (items: ChecklistEntry[]) => void
  onSelectModeChange?: (active: boolean) => void
  onSelectionChange?: (count: number, allSelected: boolean) => void
  purchaserName?: string
}) {
  const [items, setItems] = useState<ChecklistEntry[]>(initialItems ?? [])
  const [loading, setLoading] = useState(!initialItems)

  // Report the live list up so the parent's "To Buy" count stays in sync with
  // adds/completes/deletes that happen inside this component.
  useEffect(() => { onItemsChange?.(items) }, [items, onItemsChange])

  // Select-to-send mode
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [showSendSheet, setShowSendSheet] = useState(false)
  const pendingRef = useRef<ChecklistEntry[]>([])

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

  // Expose triggerSend so parent can activate select-to-send mode.
  useEffect(() => {
    if (triggerSendRef) {
      triggerSendRef.current = () => {
        setSelectedIds(new Set())
        setSelectMode(true)
        onSelectModeChange?.(true)
      }
    }
  }, [triggerSendRef, onSelectModeChange])

  useEffect(() => {
    if (triggerSelectAllRef) {
      triggerSelectAllRef.current = () => {
        setSelectedIds(prev => {
          const allSelected = pendingRef.current.every(i => prev.has(i.id))
          return allSelected ? new Set() : new Set(pendingRef.current.map(i => i.id))
        })
      }
    }
  }, [triggerSelectAllRef])

  useEffect(() => {
    if (triggerCancelSelectRef) {
      triggerCancelSelectRef.current = () => exitSelectMode()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerCancelSelectRef])

  // Expose a direct items updater so the parent can push fresh server data
  // atomically (in the same React batch as records/KPI), eliminating the
  // sequential delay that would otherwise cause cross-device dual-display.
  useEffect(() => {
    if (updateItemsRef) {
      updateItemsRef.current = (freshItems: ChecklistEntry[]) => {
        setItems(prev => {
          // protected_: items whose in-flight operations must not be overwritten by
          // a stale refresh. Includes completions, deletions, and cancel-restorations.
          const protected_ = new Set([
            ...pendingCompletes.current,
            ...pendingDeletes.current,
            ...(cancelGuardsRef?.current ?? []),
          ])
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
    setAddError(null)

    const tempId = -(Date.now())
    const optimistic: ChecklistEntry = {
      id: tempId,
      name: addForm.name,
      specification: addForm.specification || null,
      supplier: addForm.supplier || null,
      category: addForm.category,
      unit: addForm.unit,
      quantity: qty,
      note: addForm.note || null,
      status: 'pending',
      purchase_record_id: null,
      created_at: new Date().toISOString(),
      completed_at: null,
      created_by: null,
      created_by_name: purchaserName || null,
    }
    setItems(prev => [optimistic, ...prev])
    setAddForm(emptyAddForm); setAddCatalogItem(null); setShowAdd(false)

    const res = await addChecklistItemAction({
      name: optimistic.name,
      specification: optimistic.specification,
      supplier: optimistic.supplier,
      category: optimistic.category,
      unit: optimistic.unit,
      quantity: qty,
      note: optimistic.note,
    })
    if (!res.ok) {
      setItems(prev => prev.filter(i => i.id !== tempId))
      setAddForm({ name: optimistic.name, specification: optimistic.specification ?? '', supplier: optimistic.supplier ?? '', category: optimistic.category, unit: optimistic.unit, quantity: String(qty), unit_price: '', note: optimistic.note ?? '' })
      setAddError(res.error); setShowAdd(true)
      return
    }
    setItems(prev => prev.map(i => i.id === tempId ? res.data : i))
  }

  // ── Edit ───────────────────────────────────────────────────────────────────
  function openEdit(item: ChecklistEntry) {
    setEditingItem(item)
    setEditForm({
      name: item.name,
      specification: item.specification ?? '',
      supplier: item.supplier ?? '',
      category: item.category,
      unit: item.unit,
      quantity: String(item.quantity),
      unit_price: '',
      note: item.note ?? '',
    })
    setEditError(null)
  }

  async function handleEdit() {
    if (!editingItem) return
    const qty = parseFloat(editForm.quantity)
    if (!editForm.name.trim()) { setEditError('Item name is required.'); return }
    if (!qty || qty <= 0) { setEditError('Quantity must be greater than zero.'); return }
    setEditError(null)

    const original = editingItem
    const optimistic: ChecklistEntry = {
      ...original,
      name: editForm.name,
      specification: editForm.specification || null,
      supplier: editForm.supplier || null,
      category: editForm.category,
      unit: editForm.unit,
      quantity: qty,
      note: editForm.note || null,
    }
    setItems(prev => prev.map(i => i.id === original.id ? optimistic : i))
    setEditingItem(null)

    const res = await editChecklistItemAction(original.id, {
      name: optimistic.name,
      specification: optimistic.specification,
      supplier: optimistic.supplier,
      category: optimistic.category,
      unit: optimistic.unit,
      quantity: qty,
      note: optimistic.note,
    })
    if (!res.ok) {
      setItems(prev => prev.map(i => i.id === original.id ? original : i))
      setEditingItem(original); setEditError(res.error)
      return
    }
    setItems(prev => prev.map(i => i.id === original.id ? res.data : i))
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
    const completion = { unit_price: data.unitPrice, supplier: data.supplier || null, quantity: data.quantity }
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
  const pending = items
    .filter(i =>
      i.status === 'pending' &&
      i.purchase_record_id === null &&
      !(purchasedChecklistIds?.has(i.id) ?? false)
    )
    .sort((a, b) => categoryOrderIndex(a.category) - categoryOrderIndex(b.category))

  pendingRef.current = pending
  const allSelected = pending.length > 0 && pending.every(i => selectedIds.has(i.id))
  const selectedItems = pending.filter(i => selectedIds.has(i.id))
  // Notify parent of selection state so it can render controls outside the card
  useEffect(() => { onSelectionChange?.(selectedIds.size, allSelected) }, [selectedIds, allSelected, onSelectionChange])

  function exitSelectMode() {
    setSelectMode(false)
    setSelectedIds(new Set())
    onSelectModeChange?.(false)
  }

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
              catalog={catalog}
              catalogLoading={catalogLoading}
              selectMode={selectMode}
              selected={selectedIds.has(item.id)}
              onToggleSelect={(id) => setSelectedIds(prev => {
                const next = new Set(prev)
                if (next.has(id)) next.delete(id); else next.add(id)
                return next
              })}
            />
          ))}
        </div>
      )}

      {/* Select mode: generate button fixed above bottom nav */}
      {selectMode && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed left-0 right-0 flex justify-center"
          style={{ bottom: 'calc(env(safe-area-inset-bottom,0px) + 80px)', zIndex: 290 }}
        >
          <button
            type="button"
            disabled={selectedIds.size === 0}
            onClick={() => setShowSendSheet(true)}
            className="px-8 py-3 rounded-2xl text-sm font-semibold text-white shadow-lg active:opacity-80 transition-colors"
            style={{ background: selectedIds.size === 0 ? '#d1d5db' : '#f97316', minWidth: 200 }}
          >
            {selectedIds.size === 0 ? 'Select items above' : `Generate Order (${selectedIds.size})`}
          </button>
        </div>,
        document.body
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
          planningOnly={true}
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
          onDelete={() => { const it = editingItem; setEditingItem(null); requestDelete(it) }}
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
          initialSupplier={completingItem.supplier ?? ''}
          quantityEditable={true}
          showSupplier={true}
          onSave={handleCompleteSave}
          onClose={() => setCompletingItem(null)}
          onDelete={() => { const it = completingItem; setCompletingItem(null); requestDelete(it) }}
        />
      )}

      {/* Send sheet */}
      {showSendSheet && (
        <SendSheet
          items={selectedItems}
          purchaserName={purchaserName}
          catalog={catalog}
          onClose={() => { setShowSendSheet(false); exitSelectMode() }}
        />
      )}

      {/* Delete confirmation dialog — portaled to body to clear bottom nav */}
      {deleteTarget && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed flex items-center justify-center"
          style={{ top: 0, left: 0, right: 0, bottom: 0, zIndex: Z_MAX, background: 'rgba(0,0,0,0.4)' }}
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
        </div>,
        document.body
      )}
    </div>
  )
}
