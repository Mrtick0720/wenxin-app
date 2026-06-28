'use client'

import { useEffect, useState } from 'react'
import { useGlobalToast } from '@/app/components/GlobalToast'
import type { LeaveRequest, LeaveStatus } from '@/lib/schedule/types'
import { cancelLeaveRequestAction, fetchMyLeaveRequestsAction } from './schedule-actions'

const STATUS_STYLE: Record<LeaveStatus, { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Approved', cls: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-600' },
  cancelled: { label: 'Cancelled', cls: 'bg-gray-100 text-gray-500' },
}

function formatRange(start: string, end: string): string {
  if (start === end) return start
  return `${start} → ${end}`
}

export default function MyLeaveRequests({ refreshKey }: { refreshKey: number }) {
  const { showToast } = useGlobalToast()
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function reload() {
    const res = await fetchMyLeaveRequestsAction()
    if (res.ok) { setRequests(res.data); setError(null) }
    else setError(res.error)
    setLoading(false)
  }

  useEffect(() => {
    let active = true
    fetchMyLeaveRequestsAction()
      .then((res) => {
        if (!active) return
        if (res.ok) {
          setRequests(res.data)
          setError(null)
        } else {
          setError(res.error)
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [refreshKey])

  async function handleCancel(id: number) {
    if (!window.confirm('Cancel this leave request?')) return
    const res = await cancelLeaveRequestAction(id)
    if (res.ok) {
      showToast('Leave request cancelled')
      reload()
    } else {
      showToast(res.error, 'error')
    }
  }

  if (loading) {
    return <div className="text-center text-gray-400 py-6 text-sm">Loading leave requests…</div>
  }
  if (error) {
    return (
      <div className="bg-white rounded-2xl shadow-sm px-4 py-5 text-center">
        <div className="text-sm font-medium text-red-500">Couldn&apos;t load leave requests</div>
        <div className="text-xs text-gray-400 mt-1 break-words">{error}</div>
      </div>
    )
  }
  if (requests.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm px-4 py-6 text-center text-sm text-gray-400">
        No leave requests yet.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {requests.map((r) => {
        const style = STATUS_STYLE[r.status]
        return (
          <div key={r.id} className="bg-white rounded-2xl shadow-sm px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-gray-900">{formatRange(r.startDate, r.endDate)}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${style.cls}`}>{style.label}</span>
            </div>
            {r.reason && <div className="text-xs text-gray-500 mt-1">{r.reason}</div>}
            {r.status === 'pending' && (
              <button
                type="button"
                onClick={() => handleCancel(r.id)}
                className="mt-2 text-xs font-medium text-red-500 active:opacity-70"
              >
                Cancel request
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
