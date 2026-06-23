'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { createReservationAction, updateReservationAction, type NewReservationInput } from './actions'
import { todayLocalStr, addDays } from '@/lib/dateUtils'
import { DatePickerField, TimePickerField } from '@/app/components/DateTimePickerFields'

const Z_MAX = 2147483647

const inputCls =
  'w-full border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-orange-400 bg-white'

type EditReservation = {
  id: number
  customer_name: string
  phone: string | null
  date: string
  time_start: string
  time_end: string | null
  pax: number
  table_area: string | null
  preordered_dishes: string | null
  notes: string | null
}

export default function NewReservationSheet({
  date,
  edit,
  onClose,
  onCreated,
}: {
  date: string
  edit?: EditReservation
  onClose: () => void
  onCreated: () => void
}) {
  const isEdit = !!edit
  const [form, setForm] = useState<NewReservationInput>({
    customer_name: edit?.customer_name ?? '',
    phone: edit?.phone ?? '',
    date: edit?.date ?? date,
    time_start: edit?.time_start ?? '',
    time_end: edit?.time_end ?? '',
    pax: edit?.pax ?? 1,
    table_area: edit?.table_area ?? '',
    preordered_dishes: edit?.preordered_dishes ?? '',
    notes: edit?.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof NewReservationInput>(key: K, value: NewReservationInput[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    if (!form.customer_name.trim()) { setError('Customer name is required.'); return }
    if (!form.time_start) { setError('Start time is required.'); return }
    if (form.pax < 1) { setError('Pax must be at least 1.'); return }

    setSaving(true)
    setError(null)
    const payload = {
      ...form,
      customer_name: form.customer_name.trim(),
      phone: form.phone?.trim() || undefined,
      time_end: form.time_end?.trim() || undefined,
      table_area: form.table_area?.trim() || undefined,
      preordered_dishes: form.preordered_dishes?.trim() || undefined,
      notes: form.notes?.trim() || undefined,
    }
    const res = edit
      ? await updateReservationAction(edit.id, payload)
      : await createReservationAction(payload)
    setSaving(false)
    if (!res.ok) { setError(res.error); return }
    onCreated()
    onClose()
  }

  const content = (
    <div
      className="fixed flex flex-col justify-end"
      style={{ top: 0, left: 0, right: 0, bottom: 0, zIndex: Z_MAX, background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl flex flex-col"
        style={{ maxHeight: '90vh', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 pt-5 pb-3 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
          <span className="font-semibold text-base">{isEdit ? 'Edit Reservation' : 'New Reservation'}</span>
          <button type="button" onClick={onClose} className="text-gray-400 text-2xl leading-none">×</button>
        </div>

        {/* Form */}
        <div className="px-4 pt-4 pb-4 overflow-y-auto flex-1 min-h-0 space-y-3">
          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>
          )}

          <div>
            <label className="text-xs text-gray-400 mb-1 block">Customer Name *</label>
            <input className={inputCls} style={{ fontSize: 16 }} placeholder="Customer name"
              value={form.customer_name} onChange={e => set('customer_name', e.target.value)} />
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-1 block">Phone</label>
            <input className={inputCls} style={{ fontSize: 16 }} placeholder="012-3456789" type="tel"
              value={form.phone ?? ''} onChange={e => set('phone', e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Date</label>
              <div className="relative">
                <DatePickerField
                  ariaLabel="Reservation date"
                  min={todayLocalStr()}
                  value={form.date}
                  onChange={value => set('date', value)}
                />
                {form.date === todayLocalStr() && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">Today</span>
                )}
                {form.date === addDays(todayLocalStr(), 1) && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">Tomorrow</span>
                )}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Start Time *</label>
              <TimePickerField
                ariaLabel="Reservation start time"
                title="Start Time"
                value={form.time_start}
                onChange={value => set('time_start', value)}
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">End Time</label>
              <TimePickerField
                ariaLabel="Reservation end time"
                title="End Time"
                value={form.time_end ?? ''}
                onChange={value => set('time_end', value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Pax *</label>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => set('pax', Math.max(1, form.pax - 1))}
                  className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 active:bg-gray-50 text-lg">−</button>
                <span className="text-lg font-semibold text-gray-900 w-8 text-center">{form.pax}</span>
                <button type="button" onClick={() => set('pax', form.pax + 1)}
                  className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 active:bg-gray-50 text-lg">+</button>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Table / Area</label>
              <input className={inputCls} style={{ fontSize: 16 }} placeholder="e.g. Window"
                value={form.table_area ?? ''} onChange={e => set('table_area', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-1 block">Pre-ordered Dishes</label>
            <textarea className={inputCls} style={{ fontSize: 16 }}
              placeholder="e.g. 南洋香茅金汤石斑 ×1, 花胶金汤鸡 ×1"
              rows={2}
              value={form.preordered_dishes ?? ''} onChange={e => set('preordered_dishes', e.target.value)} />
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-1 block">Notes</label>
            <textarea className={inputCls} style={{ fontSize: 16 }} placeholder="Special requests, allergies, etc." rows={2}
              value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-gray-100 px-4 pt-3 pb-3">
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={onClose}
              className="py-3 rounded-2xl text-sm font-semibold bg-gray-100 text-gray-600 active:opacity-80">
              Cancel
            </button>
            <button type="button" onClick={handleSave} disabled={saving}
              className="py-3 rounded-2xl text-sm font-semibold text-white active:opacity-90"
              style={{ background: saving ? '#d1d5db' : '#f97316' }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(content, document.body)
}
