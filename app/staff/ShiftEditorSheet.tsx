'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { ShiftType } from '@/lib/attendance/types'
import { upsertStaffShiftAction } from './actions'
import { SheetActionFooter } from '@/components/ui/SheetActionFooter'
import { useGlobalToast } from '@/app/components/GlobalToast'

type Props = {
  staffUserId: string
  staffName: string
  date: string
  dateLabel: string
  currentShiftType: ShiftType | null
  currentShiftLabel: string | null
  onClose: () => void
  onSaved: () => void
  // Apply the new shift to the roster locally for instant feedback, before the
  // DB write completes. Reconciled by onSaved() once the write lands.
  onOptimistic: (shiftType: ShiftType, shiftLabel: string | null) => void
}

const SHIFT_OPTIONS: { type: ShiftType; label: string; color: string }[] = [
  { type: 'morning',   label: 'Morning',   color: '#3b82f6' },
  { type: 'full_day',  label: 'Full Day',  color: '#22c55e' },
  { type: 'afternoon', label: 'Afternoon',  color: '#a855f7' },
  { type: 'off',       label: 'Off',        color: '#6b7280' },
  { type: 'leave',     label: 'Leave',      color: '#f97316' },
]

// ── Fixed shift-time options ────────────────────────────────────────────────
const START_TIMES = ['07:00', '08:00', '09:00', '10:00'] as const
const END_TIMES = ['17:00', '20:00', '21:00', '22:00', '23:00'] as const

// Auto-selected end time when a start time is chosen (still adjustable after).
const AUTO_END: Record<string, string> = {
  '07:00': '17:00',
  '08:00': '20:00',
  '09:00': '21:00',
  '10:00': '22:00',
}

// Restaurant default full-day shift (break 15:00–17:00 is business context only).
const FULL_DAY_START = '10:00'
const FULL_DAY_END = '22:00'

// Accepts the stored "HH:MM–HH:MM" / "HH:MM-HH:MM" label and splits it.
const TIME_LABEL_RE = /^(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})$/
function parseTimeLabel(label: string): { start: string; end: string } | null {
  const m = label.trim().match(TIME_LABEL_RE)
  return m ? { start: m[1], end: m[2] } : null
}

const Z_MAX = 2147483647

export default function ShiftEditorSheet({
  staffUserId, staffName, date, dateLabel,
  currentShiftType, currentShiftLabel,
  onClose, onSaved, onOptimistic,
}: Props) {
  const { showToast } = useGlobalToast()
  const initialType = currentShiftType ?? 'off'
  const initialTimes = parseTimeLabel(currentShiftLabel ?? '')
  const [shiftType, setShiftType] = useState<ShiftType>(initialType)
  // Selected start/end times. Null = no explicit time → default shift label.
  const [startTime, setStartTime] = useState<string | null>(
    initialTimes?.start ?? (initialType === 'full_day' ? FULL_DAY_START : null),
  )
  const [endTime, setEndTime] = useState<string | null>(
    initialTimes?.end ?? (initialType === 'full_day' ? FULL_DAY_END : null),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isWorkingShift = shiftType !== 'off' && shiftType !== 'leave'

  function chooseType(type: ShiftType) {
    setShiftType(type)
    // Full Day uses the restaurant default whenever it's picked.
    if (type === 'full_day') {
      setStartTime(FULL_DAY_START)
      setEndTime(FULL_DAY_END)
    }
  }

  function chooseStart(time: string) {
    setStartTime(time)
    // Auto-set the matching default end time; still manually adjustable below.
    setEndTime(AUTO_END[time] ?? endTime)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)

    const label = isWorkingShift && startTime && endTime ? `${startTime}–${endTime}` : undefined

    // Optimistic: reflect the new shift in the roster + close immediately.
    onOptimistic(shiftType, label ?? null)
    onClose()

    // Write FIRST, then reconcile. Refetching before the write lands would read
    // the stale row and visibly revert the change.
    const res = await upsertStaffShiftAction(staffUserId, date, shiftType, label)
    if (res.ok) {
      showToast('Shift saved')
    } else {
      showToast(res.error, 'error')
    }
    onSaved()  // sync from DB (reconciles success, rolls back failure)
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
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 pt-5 pb-3 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
          <div>
            <div className="font-semibold text-base text-gray-900">{staffName}</div>
            <div className="text-xs text-gray-400 mt-0.5">{dateLabel}</div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 text-2xl leading-none p-1">×</button>
        </div>

        {/* Content */}
        <div className="px-4 pt-4 pb-4 overflow-y-auto flex-1 min-h-0 space-y-4">
          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>
          )}

          {/* Shift type picker */}
          <div>
            <label className="text-xs text-gray-400 mb-2 block">Shift Type</label>
            <div className="grid grid-cols-3 gap-2">
              {SHIFT_OPTIONS.map(opt => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => chooseType(opt.type)}
                  className="py-3 px-2 rounded-xl text-sm font-semibold border-2 transition-colors"
                  style={{
                    borderColor: shiftType === opt.type ? opt.color : '#e5e7eb',
                    backgroundColor: shiftType === opt.type ? opt.color : '#fff',
                    color: shiftType === opt.type ? '#fff' : '#374151',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Start / End time selectors — only for working shifts */}
          {isWorkingShift && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-400 mb-2 block">Start Time</label>
                <div className="grid grid-cols-4 sm:grid-cols-2 gap-2">
                  {START_TIMES.map(time => {
                    const active = startTime === time
                    return (
                      <button
                        key={time}
                        type="button"
                        onClick={() => chooseStart(time)}
                        className={`py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                          active
                            ? 'border-orange-400 bg-orange-50 text-orange-600'
                            : 'border-gray-200 bg-white text-gray-600 active:bg-gray-50'
                        }`}
                      >
                        {time}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-2 block">End Time</label>
                <div className="grid grid-cols-4 sm:grid-cols-3 gap-2">
                  {END_TIMES.map(time => {
                    const active = endTime === time
                    return (
                      <button
                        key={time}
                        type="button"
                        onClick={() => setEndTime(time)}
                        className={`py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                          active
                            ? 'border-orange-400 bg-orange-50 text-orange-600'
                            : 'border-gray-200 bg-white text-gray-600 active:bg-gray-50'
                        }`}
                      >
                        {time}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <SheetActionFooter className="border-t border-gray-100">
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
        </SheetActionFooter>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(content, document.body)
}
