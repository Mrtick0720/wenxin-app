'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useGlobalToast } from '@/app/components/GlobalToast'
import type { LeaveRequest, LeaveStatus } from '@/lib/schedule/types'
import { fetchLeaveRequestsAction, reviewLeaveRequestAction } from './schedule-actions'

type Props = {
  onClose: () => void
  onReviewed: () => void
}

const Z_MAX = 2147483647

const STATUS_STYLE: Record<LeaveStatus, { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Approved', cls: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-600' },
  cancelled: { label: 'Cancelled', cls: 'bg-gray-100 text-gray-500' },
}

function formatRange(start: string, end: string): string {
  return start === end ? start : `${start} → ${end}`
}

export default function LeaveRequestsInbox({ onClose, onReviewed }: Props) {
  const { showToast } = useGlobalToast()
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)

  async function reload() {
    const res = await fetchLeaveRequestsAction()
    if (res.ok) setRequests(res.data)
    else showToast(res.error, 'error')
    setLoading(false)
  }

  useEffect(() => {
    let active = true
    fetchLeaveRequestsAction().then((res) => {
      if (!active) return
      if (res.ok) setRequests(res.data)
      else showToast(res.error, 'error')
      setLoading(false)
    })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function review(id: number, decision: 'approved' | 'rejected') {
    setBusyId(id)
    const res = await reviewLeaveRequestAction(id, decision)
    setBusyId(null)
    if (res.ok) {
      showToast(decision === 'approved' ? 'Leave approved' : 'Leave rejected')
      onReviewed()
      reload()
    } else {
      showToast(res.error, 'error')
    }
  }

  // Pending first, then most recent.
  const sorted = [...requests].sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1
    if (b.status === 'pending' && a.status !== 'pending') return 1
    return b.createdAt.localeCompare(a.createdAt)
  })

  const content = (
    <div
      className="fixed flex flex-col justify-end"
      style={{ top: 0, left: 0, right: 0, bottom: 0, zIndex: Z_MAX, background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div className="bg-white rounded-t-3xl flex flex-col" style={{ maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
        <div className="px-4 pt-5 pb-3 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
          <div className="font-semibold text-base text-gray-900">Leave Requests</div>
          <button type="button" onClick={onClose} className="text-gray-400 text-2xl leading-none p-1">×</button>
        </div>

        <div className="px-4 py-4 overflow-y-auto flex-1 min-h-0 space-y-2">
          {loading ? (
            <div className="text-center text-gray-400 py-8 text-sm">Loading…</div>
          ) : sorted.length === 0 ? (
            <div className="text-center text-gray-400 py-8 text-sm">No leave requests.</div>
          ) : (
            sorted.map((r) => {
              const style = STATUS_STYLE[r.status]
              return (
                <div key={r.id} className="rounded-2xl border border-gray-100 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-gray-900">{r.staffName ?? 'Staff'}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${style.cls}`}>{style.label}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{formatRange(r.startDate, r.endDate)}</div>
                  {r.reason && <div className="text-sm text-gray-700 mt-1">{r.reason}</div>}
                  {r.notes && <div className="text-xs text-gray-400 mt-0.5">{r.notes}</div>}
                  {r.status === 'pending' && (
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => review(r.id, 'rejected')}
                        className="py-2 rounded-xl text-sm font-semibold bg-red-50 text-red-600 active:opacity-80 disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => review(r.id, 'approved')}
                        className="py-2 rounded-xl text-sm font-semibold bg-green-500 text-white active:opacity-90 disabled:opacity-50"
                      >
                        Approve
                      </button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(content, document.body)
}
