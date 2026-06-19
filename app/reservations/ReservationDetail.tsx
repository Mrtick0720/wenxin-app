'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { ReservationRow } from './page'
import { updateReservationStatusAction } from './actions'

const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const weekday = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]
  return `${weekday}, ${months[d.getMonth()]} ${d.getDate()}`
}

function formatTime(t: string): string {
  return t.slice(0, 5)
}

const detailStatusConfig: Record<string, { label: string; bg: string; text: string }> = {
  confirmed: { label: 'Confirmed', bg: 'bg-green-100', text: 'text-green-700' },
  pending:   { label: 'Pending',   bg: 'bg-orange-100', text: 'text-orange-700' },
  cancelled: { label: 'Cancelled', bg: 'bg-gray-100',   text: 'text-gray-600' },
  completed: { label: 'Completed', bg: 'bg-blue-100',   text: 'text-blue-700' },
  no_show:   { label: 'No Show',   bg: 'bg-red-100',    text: 'text-red-700' },
}

const Z_MAX = 2147483647

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right max-w-[60%]">{value}</span>
    </div>
  )
}

interface Props {
  reservation: ReservationRow
  canSeePii: boolean
  canEdit: boolean
  index: number
  total: number
  onPrev?: () => void
  onNext?: () => void
  onClose: () => void
  onEdit?: () => void
  onStatusChanged: (id: number, status: string) => void
}

export default function ReservationDetail({
  reservation, canSeePii, canEdit, index, total, onPrev, onNext, onClose, onEdit, onStatusChanged,
}: Props) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [localStatus, setLocalStatus] = useState(reservation.status)

  const st = detailStatusConfig[localStatus] ?? detailStatusConfig.pending
  const timeLabel = reservation.time_end
    ? `${formatTime(reservation.time_start)} – ${formatTime(reservation.time_end)}`
    : formatTime(reservation.time_start)

  async function handleAction(newStatus: string) {
    setSaving(true)
    setError(null)
    const res = await updateReservationStatusAction(reservation.id, newStatus)
    setSaving(false)
    if (!res.ok) { setError(res.error); return }
    setLocalStatus(newStatus)
    onStatusChanged(reservation.id, newStatus)
  }

  // compact subtitle line: date · time (pii only) · pax · table
  const subtitle = [
    formatDate(reservation.date),
    canSeePii ? timeLabel : null,
    `${reservation.pax} pax`,
    reservation.table_area ?? null,
  ].filter(Boolean).join(' · ')

  const content = (
    <div
      className="fixed flex flex-col justify-end"
      style={{ top: 0, left: 0, right: 0, bottom: 0, zIndex: Z_MAX, background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Top bar: ◀ count ▶ · · · × */}
        <div className="flex items-center gap-1 px-4 pt-3 pb-1">
          <button type="button" onClick={onPrev} disabled={!onPrev}
            className="w-9 h-9 flex items-center justify-center rounded-full text-gray-400 disabled:opacity-25 active:bg-gray-100">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <span className="text-xs text-gray-400 tabular-nums">{index + 1} of {total}</span>
          <button type="button" onClick={onNext} disabled={!onNext}
            className="w-9 h-9 flex items-center justify-center rounded-full text-gray-400 disabled:opacity-25 active:bg-gray-100">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
          <div className="flex-1" />
          <button type="button" onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full text-gray-300 active:bg-gray-100 active:text-gray-600">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Header: identity + status pill */}
        <div className="px-5 pt-1 pb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-semibold text-xl text-gray-900 leading-snug truncate">
              {canSeePii ? reservation.customer_name : timeLabel}
            </div>
            <div className="text-[13px] text-gray-400 mt-1 leading-snug">{subtitle}</div>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 mt-0.5 ${st.bg} ${st.text}`}>
            {st.label}
          </span>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-5 mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>
        )}

        {/* Info — only fields not already in the header */}
        <div className="px-5 divide-y divide-gray-50">
          {canSeePii && reservation.phone && (
            <Row label="Phone" value={reservation.phone} />
          )}
          {reservation.preordered_dishes && (
            <div className="py-2.5">
              <div className="text-xs text-gray-400 mb-1">Pre-ordered Dishes</div>
              <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">{reservation.preordered_dishes}</div>
            </div>
          )}
          {canSeePii && reservation.notes && (
            <div className="py-2.5">
              <div className="text-xs text-gray-400 mb-1">Special Request</div>
              <div className="text-sm text-gray-800 leading-relaxed">{reservation.notes}</div>
            </div>
          )}
        </div>

        {/* Status-driven action area — no Close button */}
        <div className="px-5 pt-4 space-y-2">
          {canEdit && localStatus === 'pending' && (
            <>
              <button type="button" onClick={() => handleAction('confirmed')} disabled={saving}
                className="w-full py-3 rounded-2xl text-sm font-semibold text-white active:opacity-90"
                style={{ background: saving ? '#d1d5db' : '#22c55e' }}>
                {saving ? 'Saving…' : 'Confirm Reservation'}
              </button>
              {onEdit && (
                <button type="button" onClick={onEdit}
                  className="w-full py-3 rounded-2xl text-sm font-semibold text-gray-700 bg-gray-100 active:bg-gray-200">
                  Edit Reservation
                </button>
              )}
              <button type="button" onClick={() => handleAction('cancelled')} disabled={saving}
                className="w-full py-2.5 text-sm font-medium text-red-400 active:text-red-600">
                Cancel Reservation
              </button>
            </>
          )}

          {canEdit && localStatus === 'confirmed' && (
            <>
              <button type="button" onClick={() => handleAction('completed')} disabled={saving}
                className="w-full py-3 rounded-2xl text-sm font-semibold text-white active:opacity-90"
                style={{ background: saving ? '#d1d5db' : '#3b82f6' }}>
                {saving ? 'Saving…' : 'Mark Completed'}
              </button>
              {onEdit && (
                <button type="button" onClick={onEdit}
                  className="w-full py-3 rounded-2xl text-sm font-semibold text-gray-700 bg-gray-100 active:bg-gray-200">
                  Edit Reservation
                </button>
              )}
              <button type="button" onClick={() => handleAction('cancelled')} disabled={saving}
                className="w-full py-2.5 text-sm font-medium text-red-400 active:text-red-600">
                Cancel Reservation
              </button>
            </>
          )}

          {(localStatus === 'completed' || localStatus === 'cancelled' || localStatus === 'no_show') && (
            <div className={`w-full py-3 rounded-2xl text-sm font-medium text-center ${st.bg} ${st.text}`}>
              {localStatus === 'completed' ? 'Reservation completed' :
               localStatus === 'cancelled' ? 'Reservation cancelled' :
               'Marked as no show'}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(content, document.body)
}
