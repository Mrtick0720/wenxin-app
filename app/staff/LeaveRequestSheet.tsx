'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { SheetActionFooter } from '@/components/ui/SheetActionFooter'
import { useGlobalToast } from '@/app/components/GlobalToast'
import { todayLocalStr } from '@/lib/dateUtils'
import { submitLeaveRequestAction } from './schedule-actions'

type Props = {
  onClose: () => void
  onSubmitted: () => void
}

const Z_MAX = 2147483647

export default function LeaveRequestSheet({ onClose, onSubmitted }: Props) {
  const { showToast } = useGlobalToast()
  const today = todayLocalStr()
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setError(null)
    if (!reason.trim()) {
      setError('Please enter a reason.')
      return
    }
    if (endDate < startDate) {
      setError('End date cannot be before start date.')
      return
    }
    setSaving(true)
    const res = await submitLeaveRequestAction({ startDate, endDate, reason, notes })
    setSaving(false)
    if (res.ok) {
      showToast('Leave request submitted')
      onSubmitted()
      onClose()
    } else {
      setError(res.error)
    }
  }

  const content = (
    <div
      className="fixed flex flex-col justify-end"
      style={{ top: 0, left: 0, right: 0, bottom: 0, zIndex: Z_MAX, background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl flex flex-col"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 pt-5 pb-3 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
          <div className="font-semibold text-base text-gray-900">Request Leave</div>
          <button type="button" onClick={onClose} className="text-gray-400 text-2xl leading-none p-1">×</button>
        </div>

        <div className="px-4 pt-4 pb-4 overflow-y-auto flex-1 min-h-0 space-y-4">
          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Start date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  if (endDate < e.target.value) setEndDate(e.target.value)
                }}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-orange-400"
                style={{ fontSize: 16 }}
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">End date</label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-orange-400"
                style={{ fontSize: 16 }}
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-1 block">Reason</label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Sick leave, personal matter"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-orange-400"
              style={{ fontSize: 16 }}
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-1 block">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Any extra details for the manager…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-orange-400 resize-none"
              style={{ fontSize: 16 }}
            />
          </div>
        </div>

        <SheetActionFooter className="border-t border-gray-100">
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={onClose}
              className="py-3 rounded-2xl text-sm font-semibold bg-gray-100 text-gray-600 active:opacity-80">
              Cancel
            </button>
            <button type="button" onClick={handleSubmit} disabled={saving}
              className="py-3 rounded-2xl text-sm font-semibold text-white active:opacity-90"
              style={{ background: saving ? '#d1d5db' : '#f97316' }}>
              {saving ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        </SheetActionFooter>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(content, document.body)
}
