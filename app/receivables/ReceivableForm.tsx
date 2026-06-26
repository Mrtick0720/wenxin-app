'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import MoneyInput from '@/app/components/MoneyInput'
import { createReceivableAction, updateReceivableAction, type ReceivableInput, type Receivable } from './actions'
import { DatePickerField } from '@/app/components/DateTimePickerFields'

const Z = 2147483647
const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-400 bg-white'

export default function ReceivableForm({
  edit,
  onClose,
  onSaved,
}: {
  edit?: Receivable
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!edit
  const [form, setForm] = useState<ReceivableInput>({
    customer_name: edit?.customer_name ?? '',
    original_amount: edit?.original_amount ?? 0,
    due_date: edit?.due_date ?? '',
    notes: edit?.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof ReceivableInput>(key: K, val: ReceivableInput[K]) {
    setForm(f => ({ ...f, [key]: val }))
  }

  async function handleSave() {
    if (!form.customer_name.trim()) { setError('Customer name is required.'); return }
    if (!form.original_amount || form.original_amount <= 0) { setError('Amount must be greater than 0.'); return }
    setSaving(true)
    setError(null)
    const payload: ReceivableInput = {
      customer_name: form.customer_name.trim(),
      original_amount: Number(form.original_amount),
      due_date: form.due_date?.trim() || undefined,
      notes: form.notes?.trim() || undefined,
    }
    const res = edit
      ? await updateReceivableAction(edit.id, payload)
      : await createReceivableAction(payload)
    setSaving(false)
    if (!res.ok) { setError(res.error); return }
    onSaved()
    onClose()
  }

  const content = (
    <div className="fixed flex flex-col justify-end"
      style={{ inset: 0, zIndex: Z, background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}>
      <div className="bg-white rounded-t-3xl flex flex-col"
        style={{ maxHeight: '85vh', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
        onClick={e => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
          <span className="font-semibold text-base">{isEdit ? 'Edit Receivable' : 'New Receivable'}</span>
          <button type="button" onClick={onClose} className="text-gray-400 text-2xl leading-none">×</button>
        </div>
        <div className="px-5 pt-4 pb-4 overflow-y-auto flex-1 min-h-0 space-y-3">
          {error && <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Customer Name *</label>
            <input className={inputCls} style={{ fontSize: 16 }} placeholder="Customer name"
              value={form.customer_name} onChange={e => set('customer_name', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Amount (RM) *</label>
            <MoneyInput
              value={form.original_amount}
              onChange={v => set('original_amount', v ?? 0)}
              max="cash"
              className={inputCls}
              style={{ fontSize: 16 }}
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Due Date</label>
            <DatePickerField
              ariaLabel="Due date"
              value={form.due_date ?? ''}
              onChange={value => set('due_date', value)}
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Notes</label>
            <textarea className={inputCls} style={{ fontSize: 16 }} rows={2} placeholder="Optional"
              value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
        <div className="flex-shrink-0 border-t border-gray-100 px-5 pt-3 pb-3 flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 py-3 rounded-2xl text-sm font-semibold bg-gray-100 text-gray-600 active:opacity-80">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="flex-1 py-3 rounded-2xl text-sm font-semibold text-white active:opacity-90"
            style={{ background: saving ? '#d1d5db' : '#f97316' }}>
            {saving ? 'Saving…' : isEdit ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
  if (typeof document === 'undefined') return null
  return createPortal(content, document.body)
}
