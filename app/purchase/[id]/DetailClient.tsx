'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { PURCHASE_CATEGORIES, categoryColor } from '@/lib/purchaseLedger/categories'
import type { PurchaseRecord } from '@/lib/purchaseLedger/types'
import BackButton from '../../components/BackButton'
import CatalogCombobox from '../CatalogCombobox'
import type { CatalogItem } from '@/lib/purchaseLedger/catalog'
import {
  fetchRecordContextAction,
  fetchCatalogAction,
  updateRecordAction,
  deleteRecordAction,
} from '../actions'

const UNITS = ['kg', 'g', 'pcs', 'pack', 'box', 'bottle', 'bag', 'tray', 'bundle', 'carton', 'pail', 'portion']

function formatCreatedAt(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kuching',
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(d)
}

function InlinePicker({ value, options, onChange, label, disabled }: {
  value: string; options: string[]; onChange: (v: string) => void; label: string; disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button type="button" disabled={disabled} onClick={() => setOpen((o) => !o)}
        className="w-full text-left flex items-center justify-between py-3 border-b border-gray-100">
        <span className="text-xs text-gray-400 w-28 flex-shrink-0">{label}</span>
        <span className="flex-1 text-gray-900" style={{ fontSize: 16 }}>{value}</span>
        {!disabled && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}><polyline points="6 9 12 15 18 9" /></svg>
        )}
      </button>
      {open && !disabled && (
        <div className="absolute left-0 right-0 bg-white border border-gray-100 rounded-xl shadow-lg z-20 overflow-y-auto" style={{ top: '100%', maxHeight: 240 }}>
          {options.map((opt) => (
            <button key={opt} type="button" onClick={() => { onChange(opt); setOpen(false) }}
              className="w-full text-left px-4 py-3 hover:bg-orange-50 border-b border-gray-50 last:border-0"
              style={{ fontSize: 16, color: opt === value ? '#f97316' : '#374151', fontWeight: opt === value ? 600 : 400 }}>{opt}</button>
          ))}
        </div>
      )}
    </div>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center py-3 border-b border-gray-100">
      <span className="text-xs text-gray-400 w-28 flex-shrink-0">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  )
}

type Props = { itemId?: number; onChanged?: () => void }

export default function DetailClient({ itemId, onChanged }: Props) {
  const params = useParams()
  const router = useRouter()
  const id = itemId ?? Number(params?.id)

  const [record, setRecord] = useState<PurchaseRecord | null>(null)
  const [canViewCosts, setCanViewCosts] = useState(false)
  const [canEdit, setCanEdit] = useState(false)
  const [canDelete, setCanDelete] = useState(false)
  const [enteredByName, setEnteredByName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<CatalogItem | null>(null)

  const [form, setForm] = useState({
    name: '', specification: '', category: 'Vegetables', unit: 'kg',
    quantity: '', unit_price: '', supplier: '', purchaser: '', receiver: '', remarks: '',
    purchase_method: '', payment_status: '',
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id || Number.isNaN(id)) { setNotFound(true); setLoading(false); return }
    fetchRecordContextAction(id).then((res) => {
      if (!res.ok) { setNotFound(true); setLoading(false); return }
      const r = res.data.record
      setRecord(r)
      setCanViewCosts(res.data.canViewCosts)
      setCanEdit(res.data.canEdit)
      setCanDelete(res.data.canDelete)
      setEnteredByName(res.data.enteredByName)
      setForm({
        name: r.name ?? '',
        specification: r.specification ?? '',
        category: r.category ?? 'Vegetables',
        unit: r.unit ?? 'kg',
        quantity: String(r.quantity ?? ''),
        unit_price: r.unit_price != null ? String(r.unit_price) : '',
        supplier: r.supplier ?? '',
        purchaser: r.purchaser ?? '',
        receiver: r.receiver ?? '',
        remarks: r.note ?? '',
        purchase_method: r.purchase_method ?? '',
        payment_status: r.payment_status ?? 'unpaid',
      })
      setLoading(false)
    })
  }, [id])

  useEffect(() => {
    fetchCatalogAction()
      .then((res) => {
        if (res.ok) setCatalog(res.data)
        else setCatalogError(res.error)
      })
      .catch((e) => setCatalogError(e?.message ?? 'Failed to load catalog'))
      .finally(() => setCatalogLoading(false))
  }, [])

  // Sync selected catalog item whenever both record name and catalog are ready.
  useEffect(() => {
    if (!record || catalog.length === 0) return
    const match = catalog.find((item) => item.name_zh === record.name) ?? null
    setSelectedCatalogItem(match)
  }, [record, catalog])

  function done() {
    if (onChanged) onChanged()
    else router.push('/purchase')
  }

  async function handleSave() {
    if (!record) return
    setSaving(true)
    setError(null)
    const res = await updateRecordAction(record.id, {
      name: form.name.trim(),
      specification: form.specification.trim() || null,
      category: form.category,
      unit: form.unit,
      quantity: parseFloat(form.quantity) || 0,
      unit_price: canViewCosts && form.unit_price ? parseFloat(form.unit_price) : null,
      supplier: canViewCosts ? form.supplier.trim() || null : null,
      purchaser: form.purchaser.trim() || null,
      receiver: form.receiver.trim() || null,
      remarks: form.remarks.trim() || null,
      purchase_method: form.purchase_method.trim() || null,
      payment_status: form.payment_status.trim() || null,
    })
    setSaving(false)
    if (!res.ok) { setError(res.error); return }
    done()
  }

  async function handleDelete() {
    if (!record) return
    setDeleting(true)
    setError(null)
    const res = await deleteRecordAction(record.id)
    setDeleting(false)
    if (!res.ok) { setError(res.error); return }
    done()
  }

  const qty = parseFloat(form.quantity) || 0
  const up = parseFloat(form.unit_price) || 0
  const total = qty * up
  const catColor = categoryColor(form.category)

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#f9fafb', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <div className="text-gray-400 text-sm">Record not found</div>
        <button onClick={() => router.push('/purchase')} className="text-orange-500 text-sm font-medium">← Back to Purchase</button>
      </div>
    )
  }

  const readOnly = !canEdit

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f9fafb' }}>
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b" style={{ flexShrink: 0 }}>
        <div className="flex items-center gap-3">
          <BackButton href="/purchase" />
          <span className="font-semibold text-base">{readOnly ? 'Record' : 'Edit Record'}</span>
        </div>
        {!readOnly && (
          <button onClick={handleSave} disabled={saving || !form.name.trim()}
            className="text-sm font-semibold px-4 py-1.5 rounded-full"
            style={{ background: form.name.trim() ? '#f97316' : '#e5e7eb', color: form.name.trim() ? '#fff' : '#9ca3af' }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)' }}>
        <div style={{ height: 4, background: catColor }} />

        {error && (
          <div className="mx-4 mt-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>
        )}

        <div className="bg-white px-4">
          <FieldRow label="Name">
            {readOnly ? (
              <span className="text-gray-900 font-medium" style={{ fontSize: 16 }}>{form.name || '—'}</span>
            ) : (
              <CatalogCombobox
                items={catalog}
                selectedItem={selectedCatalogItem}
                loading={catalogLoading}
                error={catalogError}
                onSelect={(item) => {
                  setSelectedCatalogItem(item)
                  setForm((f) => ({ ...f, name: item.name_zh, category: item.category, unit: item.unit }))
                }}
                placeholder={form.name || 'Select item…'}
              />
            )}
          </FieldRow>

          <FieldRow label="Specification">
            <input className="w-full outline-none text-gray-900" style={{ fontSize: 16 }} readOnly={readOnly}
              value={form.specification} onChange={(e) => setForm((f) => ({ ...f, specification: e.target.value }))} placeholder="Optional" />
          </FieldRow>

          <InlinePicker label="Category" value={form.category} options={[...PURCHASE_CATEGORIES]} disabled={readOnly}
            onChange={(v) => setForm((f) => ({ ...f, category: v }))} />

          <InlinePicker label="Unit" value={form.unit} options={UNITS} disabled={readOnly}
            onChange={(v) => setForm((f) => ({ ...f, unit: v }))} />

          <FieldRow label="Qty">
            <input className="w-full outline-none text-gray-900" style={{ fontSize: 16 }} type="number" inputMode="decimal" readOnly={readOnly}
              value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} placeholder="0" />
          </FieldRow>

          {canViewCosts && (
            <>
              <FieldRow label="Unit Price (RM)">
                <input className="w-full outline-none text-gray-900" style={{ fontSize: 16 }} type="number" inputMode="decimal" readOnly={readOnly}
                  value={form.unit_price} onChange={(e) => setForm((f) => ({ ...f, unit_price: e.target.value }))} placeholder="0.00" />
              </FieldRow>
              <FieldRow label="Total">
                <span className="font-semibold text-gray-900" style={{ fontSize: 16 }}>{total > 0 ? `RM ${total.toFixed(2)}` : '—'}</span>
              </FieldRow>
              <FieldRow label="Supplier">
                <input className="w-full outline-none text-gray-900" style={{ fontSize: 16 }} readOnly={readOnly}
                  value={form.supplier} onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))} placeholder="e.g. KK Meat Supply" />
              </FieldRow>
            </>
          )}

          <FieldRow label="Purchaser">
            <input className="w-full outline-none text-gray-900" style={{ fontSize: 16 }} readOnly={readOnly}
              value={form.purchaser} onChange={(e) => setForm((f) => ({ ...f, purchaser: e.target.value }))} placeholder="Who bought it" />
          </FieldRow>

          <FieldRow label="Receiver">
            <input className="w-full outline-none text-gray-900" style={{ fontSize: 16 }} readOnly={readOnly}
              value={form.receiver} onChange={(e) => setForm((f) => ({ ...f, receiver: e.target.value }))} placeholder="Optional" />
          </FieldRow>

          <FieldRow label="Remarks">
            <input className="w-full outline-none text-gray-900" style={{ fontSize: 16 }} readOnly={readOnly}
              value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} placeholder="Optional" />
          </FieldRow>

          {/* Payment fields */}
          {canViewCosts && (
            <>
              <FieldRow label="Pay Method">
                {readOnly ? (
                  <span className="text-gray-700" style={{ fontSize: 16 }}>{form.purchase_method || '—'}</span>
                ) : (
                  <InlinePicker label="" value={form.purchase_method || 'Supplier Delivery'}
                    options={['Supplier Delivery', 'Cash', 'QR', 'Bank Transfer', 'Other']}
                    disabled={false}
                    onChange={(v) => setForm((f) => ({ ...f, purchase_method: v }))} />
                )}
              </FieldRow>
              <FieldRow label="Pay Status">
                {readOnly ? (
                  <span className="text-gray-700" style={{ fontSize: 16 }}>{form.payment_status === 'paid' ? 'Paid' : form.payment_status === 'unpaid' ? 'Unpaid' : form.payment_status === 'pay_later' ? 'Pay Later' : form.payment_status || '—'}</span>
                ) : (
                  <InlinePicker label="" value={form.payment_status || 'unpaid'}
                    options={['paid', 'unpaid', 'pay_later']}
                    disabled={false}
                    onChange={(v) => setForm((f) => ({ ...f, payment_status: v }))} />
                )}
              </FieldRow>
            </>
          )}

          {/* ── Audit info (read-only) ── */}
          <div className="mt-4 pt-2 border-t-2 border-gray-100">
            <div className="text-xs text-gray-400 font-medium px-1 mb-1">Audit</div>
          </div>
          <FieldRow label="Added by">
            <span className="text-gray-700" style={{ fontSize: 16 }}>{record?.created_by_name ?? enteredByName ?? '—'}</span>
          </FieldRow>
          <FieldRow label="Purchased by">
            <span className="text-gray-700" style={{ fontSize: 16 }}>{record?.purchased_by_name ?? '—'}</span>
          </FieldRow>
          <FieldRow label="Created At">
            <span className="text-gray-700" style={{ fontSize: 16 }}>{formatCreatedAt(record?.created_at ?? null)}</span>
          </FieldRow>
        </div>

        {canDelete && (
          <div className="px-4 mt-4 mb-8">
            {!showDelete ? (
              <button onClick={() => setShowDelete(true)} className="w-full py-3 rounded-2xl text-sm font-medium text-red-400 border border-red-100 bg-red-50">Delete Record</button>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                <div className="text-sm text-red-600 font-medium mb-3 text-center">Delete &quot;{record?.name}&quot;?</div>
                <div className="flex gap-2">
                  <button onClick={() => setShowDelete(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-white border border-gray-200 text-gray-600">Cancel</button>
                  <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500">{deleting ? 'Deleting...' : 'Delete'}</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
