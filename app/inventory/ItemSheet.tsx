'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  createItemAction,
  updateItemAction,
  fetchInventoryCatalogAction,
  fetchInventoryStatusByCatalogAction,
} from './manage-actions'
import type { InventoryView, ItemCreateData, ItemUpdateData, InventoryCatalogItem, DisplayStatus } from '@/lib/inventory/types'
import { SheetActionFooter } from '@/components/ui/SheetActionFooter'
import InventoryItemPicker from './InventoryItemPicker'
import { INVENTORY_CATEGORIES } from '@/lib/inventory/status'
import { PURCHASE_UNITS } from '@/lib/units'
import { useGlobalToast } from '@/app/components/GlobalToast'

type Props = {
  mode: 'add' | 'edit'
  item?: InventoryView
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

type FormState = {
  category: string
  unit: string
  trackOpened: boolean
  reorderLevel: string
  reorderPoint: string
  parLevel: string
  leadTimeDays: string
  location: string
  supplier: string
  notes: string
  initialQuantity: string
  initialOpenedQty: string
}

function emptyForm(): FormState {
  return {
    category: '',
    unit: '',
    trackOpened: false,
    reorderLevel: '',
    reorderPoint: '',
    parLevel: '',
    leadTimeDays: '',
    location: '',
    supplier: '',
    notes: '',
    initialQuantity: '0',
    initialOpenedQty: '0',
  }
}

function formFromItem(item: InventoryView): FormState {
  return {
    category: item.category,
    unit: item.unit,
    trackOpened: item.trackOpened,
    reorderLevel: item.reorderLevel > 0 ? String(item.reorderLevel) : '',
    reorderPoint: item.reorderPoint != null ? String(item.reorderPoint) : '',
    parLevel: item.parLevel != null ? String(item.parLevel) : '',
    leadTimeDays: item.leadTimeDays != null ? String(item.leadTimeDays) : '',
    location: item.location ?? '',
    supplier: item.supplier ?? '',
    notes: item.notes ?? '',
    initialQuantity: '0',
    initialOpenedQty: '0',
  }
}

export default function ItemSheet({ mode, item, isOpen, onClose, onSaved }: Props) {
  const { showToast } = useGlobalToast()
  const [form, setForm] = useState<FormState>(emptyForm)
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<InventoryCatalogItem | null>(null)
  const [catalogItems, setCatalogItems] = useState<InventoryCatalogItem[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [existingItems, setExistingItems] = useState<Map<number, { currentQuantity: number; displayStatus: DisplayStatus }>>(new Map())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setForm(mode === 'edit' && item ? formFromItem(item) : emptyForm())
    setSelectedCatalogItem(null)
    setSaving(false)
    setError(null)

    if (mode === 'add') {
      setCatalogLoading(true)
      setCatalogError(null)
      setExistingItems(new Map())
      Promise.all([
        fetchInventoryCatalogAction(),
        fetchInventoryStatusByCatalogAction(),
      ]).then(([catalogResult, statusResult]) => {
        setCatalogLoading(false)
        if (catalogResult.ok) setCatalogItems(catalogResult.data)
        else setCatalogError(catalogResult.error)
        if (statusResult.ok) {
          const map = new Map<number, { currentQuantity: number; displayStatus: DisplayStatus }>()
          for (const s of statusResult.data) {
            map.set(s.catalogId, { currentQuantity: s.currentQuantity, displayStatus: s.displayStatus })
          }
          setExistingItems(map)
        }
        // Status fetch failure is non-fatal: picker still works, just without
        // duplicate indicators until the catalog_id migration is applied.
      })
    }
  }, [isOpen, mode, item])

  function set<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function handleSelectCatalog(item: InventoryCatalogItem) {
    setSelectedCatalogItem(item)
    set('trackOpened', item.trackInventory)
  }

  const initialQty = parseFloat(form.initialQuantity) || 0
  const initialOpenedQty = parseFloat(form.initialOpenedQty) || 0
  const initOpenedError = form.trackOpened && mode === 'add' && initialOpenedQty > initialQty
  const unitEmpty = mode === 'edit' && form.unit.trim() === ''

  const canSave = mode === 'add'
    ? selectedCatalogItem !== null && !initOpenedError
    : !initOpenedError && !unitEmpty

  const displayUnit = mode === 'add'
    ? (selectedCatalogItem?.unit ?? 'units')
    : (form.unit.trim() || (item?.unit ?? 'units'))

  async function handleSave() {
    if (!canSave || saving) return
    setSaving(true)
    setError(null)

    let payload: ItemCreateData | ItemUpdateData
    let action: () => Promise<{ ok: true; id?: number } | { ok: false; error: string }>

    if (mode === 'add') {
      payload = {
        catalogId: selectedCatalogItem!.id,
        trackOpened: form.trackOpened,
        reorderLevel: parseFloat(form.reorderLevel) || 0,
        reorderPoint: form.reorderPoint !== '' ? parseFloat(form.reorderPoint) : null,
        parLevel: form.parLevel !== '' ? parseFloat(form.parLevel) : null,
        leadTimeDays: form.leadTimeDays !== '' ? parseInt(form.leadTimeDays, 10) : null,
        location: form.location.trim() || null,
        supplier: form.supplier.trim() || null,
        notes: form.notes.trim() || null,
        initialQuantity: initialQty,
        initialOpenedQuantity: form.trackOpened ? initialOpenedQty : 0,
      } as ItemCreateData
      action = () => createItemAction(payload as ItemCreateData)
    } else {
      payload = {
        category: form.category.trim() || item!.category,
        unit: form.unit.trim() || item!.unit,
        trackOpened: form.trackOpened,
        reorderLevel: parseFloat(form.reorderLevel) || 0,
        reorderPoint: form.reorderPoint !== '' ? parseFloat(form.reorderPoint) : null,
        parLevel: form.parLevel !== '' ? parseFloat(form.parLevel) : null,
        leadTimeDays: form.leadTimeDays !== '' ? parseInt(form.leadTimeDays, 10) : null,
        location: form.location.trim() || null,
        supplier: form.supplier.trim() || null,
        notes: form.notes.trim() || null,
      } as ItemUpdateData
      action = () => updateItemAction(item!.id, payload as ItemUpdateData)
    }

    // Optimistic: show success + close immediately
    showToast(mode === 'add' ? 'Item added' : 'Item updated')
    onSaved()
    onClose()

    const result = await action()
    if (!result.ok) {
      showToast(result.error, 'error')
      onSaved()  // refetch to rollback
    }
  }

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[500] bg-white flex flex-col">

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
        <span className="font-semibold text-base flex-1">
          {mode === 'add' ? 'Add Inventory Item' : 'Edit Item'}
        </span>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-5 pb-4 space-y-6">

        {/* ── Inventory Item (add) / Item Info (edit) ──────────── */}
        {mode === 'add' ? (
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Inventory Item <span className="text-red-400">*</span>
            </h3>
            <InventoryItemPicker
              items={catalogItems}
              selectedItem={selectedCatalogItem}
              onSelect={handleSelectCatalog}
              existingItems={existingItems}
              placeholder="Select Inventory Item..."
              loading={catalogLoading}
              error={catalogError}
            />
            {selectedCatalogItem && (
              <div className="flex items-center gap-2 px-1">
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-600">
                  {selectedCatalogItem.category}
                </span>
                <span className="text-xs text-gray-300">·</span>
                <span className="text-xs text-gray-500">{selectedCatalogItem.unit}</span>
              </div>
            )}
          </section>
        ) : (
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Item</h3>
            {/* Name — always read-only (owned by catalog or fixed at creation) */}
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <div className="font-semibold text-gray-900 text-sm">{item?.name}</div>
              {item?.catalogId != null && (
                <div className="text-xs text-gray-400 mt-0.5">Managed by Purchase Catalog</div>
              )}
            </div>
            {/* Category — editable */}
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">Category</label>
              <select
                value={form.category}
                onChange={e => set('category', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400 bg-white"
              >
                {INVENTORY_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
                {/* If item has a non-standard category, keep it selectable */}
                {item?.category && !INVENTORY_CATEGORIES.includes(item.category as never) && (
                  <option value={item.category}>{item.category}</option>
                )}
              </select>
            </div>
            {/* Unit — editable, shared with Purchase module */}
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">Unit</label>
              <select
                value={form.unit}
                onChange={e => set('unit', e.target.value)}
                className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none bg-white ${
                  unitEmpty ? 'border-red-400 focus:border-red-400' : 'border-gray-200 focus:border-orange-400'
                }`}
              >
                <option value="">Select unit…</option>
                {PURCHASE_UNITS.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
                {/* Keep legacy unit selectable if it isn't in the standard list */}
                {form.unit && !PURCHASE_UNITS.includes(form.unit) && (
                  <option value={form.unit}>{form.unit} (current)</option>
                )}
              </select>
              {unitEmpty && <p className="text-xs text-red-500 mt-1">Unit is required</p>}
            </div>
          </section>
        )}

        {/* ── Stock Settings ─────────────────────────────────── */}
        <section className="space-y-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Stock Settings</h3>

          {/* Track opened toggle */}
          <div className="flex items-center justify-between py-0.5">
            <div>
              <div className="text-sm font-medium text-gray-900">Track Opened / Unopened</div>
              <div className="text-xs text-gray-400 mt-0.5">Track opened and unopened stock separately</div>
            </div>
            <button
              type="button"
              onClick={() => set('trackOpened', !form.trackOpened)}
              className={`w-12 h-6 rounded-full transition-colors flex-shrink-0 relative ml-3 ${
                form.trackOpened ? 'bg-orange-500' : 'bg-gray-200'
              }`}
              aria-label="Toggle track opened"
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                  form.trackOpened ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* Initial quantities — add mode only */}
          {mode === 'add' && (
            <div className="bg-gray-50 rounded-xl p-3 space-y-2.5">
              <div className="text-xs text-gray-500 font-medium">Initial Stock</div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 w-20 flex-shrink-0">Total</label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={form.initialQuantity}
                  onChange={e => set('initialQuantity', e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-orange-400"
                />
                <span className="text-xs text-gray-400 w-16 flex-shrink-0 truncate">
                  {displayUnit}
                </span>
              </div>
              {form.trackOpened && (
                <>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500 w-20 flex-shrink-0">Opened</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      value={form.initialOpenedQty}
                      onChange={e => set('initialOpenedQty', e.target.value)}
                      className={`flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none ${
                        initOpenedError
                          ? 'border-red-400 focus:border-red-400'
                          : 'border-gray-200 focus:border-orange-400'
                      }`}
                    />
                    <span className="text-xs text-gray-400 w-16 flex-shrink-0 truncate">
                      {displayUnit}
                    </span>
                  </div>
                  {initOpenedError && (
                    <p className="text-xs text-red-500">Opened cannot exceed total</p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Threshold grid */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Min Stock</label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                value={form.reorderLevel}
                onChange={e => set('reorderLevel', e.target.value)}
                placeholder="0"
                className="w-full border border-gray-200 rounded-xl px-2.5 py-2 text-sm focus:outline-none focus:border-orange-400"
              />
              <div className="text-xs text-gray-300 mt-0.5">Low Stock</div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Reorder At</label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                value={form.reorderPoint}
                onChange={e => set('reorderPoint', e.target.value)}
                placeholder="—"
                className="w-full border border-gray-200 rounded-xl px-2.5 py-2 text-sm focus:outline-none focus:border-orange-400"
              />
              <div className="text-xs text-gray-300 mt-0.5">Order trigger</div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Par Level</label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                value={form.parLevel}
                onChange={e => set('parLevel', e.target.value)}
                placeholder="—"
                className="w-full border border-gray-200 rounded-xl px-2.5 py-2 text-sm focus:outline-none focus:border-orange-400"
              />
              <div className="text-xs text-gray-300 mt-0.5">Target</div>
            </div>
          </div>
        </section>

        {/* ── Logistics ──────────────────────────────────────── */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Logistics</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">Lead Time (days)</label>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={form.leadTimeDays}
                onChange={e => set('leadTimeDays', e.target.value)}
                placeholder="—"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">Location</label>
              <input
                type="text"
                value={form.location}
                onChange={e => set('location', e.target.value)}
                placeholder="Dry Store"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Supplier</label>
            <input
              type="text"
              value={form.supplier}
              onChange={e => set('supplier', e.target.value)}
              placeholder="Supplier name"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400"
            />
          </div>
        </section>

        {/* ── Notes ─────────────────────────────────────────── */}
        <section className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Notes</h3>
          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder="Optional notes…"
            rows={3}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400 resize-none"
          />
        </section>

      </div>

      {/* Save bar */}
      <SheetActionFooter className="border-t">
        {error && <p className="text-xs text-red-500 mb-2 text-center">{error}</p>}
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
          {saving ? 'Saving…' : mode === 'add' ? 'Add Item' : 'Save Changes'}
        </button>
      </SheetActionFooter>

    </div>,
    document.body
  )
}
