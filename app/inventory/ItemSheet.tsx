'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { createItemAction, updateItemAction, archiveItemAction, deleteItemAction } from './manage-actions'
import type { InventoryView, ItemCreateData, ItemUpdateData } from '@/lib/inventory/types'
import { SheetActionFooter } from '@/components/ui/SheetActionFooter'

const CATEGORIES = ['Fresh', 'Sauces', 'Dry Goods', 'Drinks', 'Packaging', 'Supplies']
const UNIT_QUICKPICKS = ['kg', 'g', 'bottles', 'tubs', 'pcs', 'bags', 'pairs', 'cartons', 'packs']

type Props = {
  mode: 'add' | 'edit'
  item?: InventoryView
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

type FormState = {
  name: string
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
    name: '',
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
    name: item.name,
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
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [archiveConfirm, setArchiveConfirm] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setForm(mode === 'edit' && item ? formFromItem(item) : emptyForm())
      setSaving(false)
      setError(null)
      setToast(null)
      setArchiveConfirm(false)
      setArchiving(false)
      setDeleteConfirm(false)
      setDeleting(false)
    }
  }, [isOpen, mode, item])

  function set<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      // auto-set trackOpened when category changes
      if (field === 'category') {
        next.trackOpened = value === 'Sauces'
      }
      return next
    })
  }

  const initialQty = parseFloat(form.initialQuantity) || 0
  const initialOpenedQty = parseFloat(form.initialOpenedQty) || 0
  const initOpenedError = form.trackOpened && mode === 'add' && initialOpenedQty > initialQty
  const canSave =
    form.name.trim() !== '' &&
    form.category !== '' &&
    form.unit.trim() !== '' &&
    !initOpenedError

  async function handleSave() {
    if (!canSave || saving) return
    setSaving(true)
    setError(null)

    let result: { ok: true; id?: number } | { ok: false; error: string }

    if (mode === 'add') {
      const payload: ItemCreateData = {
        name: form.name.trim(),
        category: form.category,
        unit: form.unit.trim(),
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
      }
      result = await createItemAction(payload)
    } else {
      const payload: ItemUpdateData = {
        name: form.name.trim(),
        category: form.category,
        unit: form.unit.trim(),
        trackOpened: form.trackOpened,
        reorderLevel: parseFloat(form.reorderLevel) || 0,
        reorderPoint: form.reorderPoint !== '' ? parseFloat(form.reorderPoint) : null,
        parLevel: form.parLevel !== '' ? parseFloat(form.parLevel) : null,
        leadTimeDays: form.leadTimeDays !== '' ? parseInt(form.leadTimeDays, 10) : null,
        location: form.location.trim() || null,
        supplier: form.supplier.trim() || null,
        notes: form.notes.trim() || null,
      }
      result = await updateItemAction(item!.id, payload)
    }

    setSaving(false)

    if (result.ok) {
      setToast(mode === 'add' ? 'Item added' : 'Item updated')
      onSaved()
      setTimeout(() => {
        setToast(null)
        onClose()
      }, 1200)
    } else {
      setError(result.error)
    }
  }

  async function handleArchive() {
    if (!item || archiving) return
    setArchiving(true)
    const result = await archiveItemAction(item.id)
    setArchiving(false)
    if (result.ok) {
      setToast('Item archived')
      onSaved()
      setTimeout(() => {
        setToast(null)
        onClose()
      }, 1200)
    } else {
      setError(result.error)
      setArchiveConfirm(false)
    }
  }

  async function handleDelete() {
    if (!item || deleting) return
    setDeleting(true)
    const result = await deleteItemAction(item.id)
    setDeleting(false)
    if (result.ok) {
      setToast('Item deleted')
      onSaved()
      setTimeout(() => {
        setToast(null)
        onClose()
      }, 1200)
    } else {
      setError(result.error)
      setDeleteConfirm(false)
    }
  }

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[500] bg-white flex flex-col">

      {/* Toast */}
      {toast && (
        <div className="fixed top-0 inset-x-0 z-[210] bg-green-500 text-white text-sm font-medium text-center py-3 px-4">
          {toast}
        </div>
      )}

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

        {/* ── Basic Info ─────────────────────────────────────── */}
        <section className="space-y-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Basic Info</h3>

          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. 牛肉面酱"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">
              Category <span className="text-red-400">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => set('category', cat)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    form.category === cat
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">
              Unit <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.unit}
              onChange={e => set('unit', e.target.value)}
              placeholder="e.g. bottles"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400 mb-2"
            />
            <div className="flex flex-wrap gap-1.5">
              {UNIT_QUICKPICKS.map(u => (
                <button
                  key={u}
                  type="button"
                  onClick={() => set('unit', u)}
                  className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
                    form.unit === u
                      ? 'bg-orange-100 text-orange-600 font-medium'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── Stock Settings ─────────────────────────────────── */}
        <section className="space-y-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Stock Settings</h3>

          {/* Track opened toggle */}
          <div className="flex items-center justify-between py-0.5">
            <div>
              <div className="text-sm font-medium text-gray-900">Track Opened / Unopened</div>
              <div className="text-xs text-gray-400 mt-0.5">For sauces and items opened gradually</div>
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
                  {form.unit || 'units'}
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
                      {form.unit || 'units'}
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
            placeholder="Optional notes..."
            rows={3}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400 resize-none"
          />
        </section>

        {/* ── Archive + Delete (edit only) ───────────────────── */}
        {mode === 'edit' && (
          <section className="border-t pt-4 space-y-4">

            {/* Archive */}
            {archiveConfirm ? (
              <div className="bg-red-50 rounded-xl p-4 space-y-3">
                <p className="text-sm font-medium text-red-600">Archive this item?</p>
                <p className="text-xs text-red-400">
                  It will be hidden from the inventory list. Historical counts are preserved.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setArchiveConfirm(false)}
                    className="flex-1 py-2 rounded-xl text-sm border border-gray-200 text-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleArchive}
                    disabled={archiving}
                    className="flex-1 py-2 rounded-xl text-sm bg-red-500 text-white font-medium disabled:opacity-50"
                  >
                    {archiving ? 'Archiving…' : 'Yes, Archive'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setArchiveConfirm(true)}
                className="text-sm text-red-400 hover:text-red-500"
              >
                Archive Item
              </button>
            )}

            {/* Delete — visually separated, more destructive */}
            <div className="border-t pt-4">
              {deleteConfirm ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-red-700">Permanently delete this item?</p>
                  <p className="text-xs text-red-500">This cannot be undone.</p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(false)}
                      className="flex-1 py-2 rounded-xl text-sm border border-gray-200 text-gray-600"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex-1 py-2 rounded-xl text-sm bg-red-700 text-white font-medium disabled:opacity-50"
                    >
                      {deleting ? 'Deleting…' : 'Delete Forever'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(true)}
                  className="text-sm text-red-700 hover:text-red-800 font-medium"
                >
                  Delete Item
                </button>
              )}
            </div>

          </section>
        )}

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
