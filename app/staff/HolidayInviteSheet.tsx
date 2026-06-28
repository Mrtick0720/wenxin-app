'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useGlobalToast } from '@/app/components/GlobalToast'
import {
  fetchHolidayInvitesAction,
  inviteToHolidayAction,
  removeHolidayInviteAction,
} from './schedule-actions'

type StaffOption = { id: string; name: string; role: string }

type Props = {
  date: string
  holidayName: string
  staff: StaffOption[]
  onClose: () => void
  onChanged: () => void
}

const Z_MAX = 2147483647

export default function HolidayInviteSheet({ date, holidayName, staff, onClose, onChanged }: Props) {
  const { showToast } = useGlobalToast()
  const [invited, setInvited] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetchHolidayInvitesAction(date).then((res) => {
      if (active && res.ok) setInvited(new Set(res.data))
      if (active) setLoading(false)
    })
    return () => {
      active = false
    }
  }, [date])

  async function toggle(staffId: string) {
    const isInvited = invited.has(staffId)
    setBusyId(staffId)
    const res = isInvited
      ? await removeHolidayInviteAction(date, staffId)
      : await inviteToHolidayAction(date, staffId)
    setBusyId(null)
    if (res.ok) {
      setInvited((prev) => {
        const next = new Set(prev)
        if (isInvited) next.delete(staffId)
        else next.add(staffId)
        return next
      })
      onChanged()
    } else {
      showToast(res.error, 'error')
    }
  }

  const content = (
    <div
      className="fixed flex flex-col justify-end"
      style={{ top: 0, left: 0, right: 0, bottom: 0, zIndex: Z_MAX, background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div className="bg-white rounded-t-3xl flex flex-col" style={{ maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
        <div className="px-4 pt-5 pb-3 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
          <div>
            <div className="font-semibold text-base text-gray-900">Invite to work</div>
            <div className="text-xs text-gray-400 mt-0.5">{holidayName} · {date}</div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 text-2xl leading-none p-1">×</button>
        </div>

        <div className="px-4 py-3 text-xs text-gray-400 flex-shrink-0">
          Everyone is on paid holiday by default. Tap a staff member to invite them to work.
        </div>

        <div className="px-4 pb-4 overflow-y-auto flex-1 min-h-0 space-y-2">
          {loading ? (
            <div className="text-center text-gray-400 py-8 text-sm">Loading…</div>
          ) : staff.length === 0 ? (
            <div className="text-center text-gray-400 py-8 text-sm">No staff to invite.</div>
          ) : (
            staff.map((s) => {
              const isInvited = invited.has(s.id)
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={busyId === s.id}
                  onClick={() => toggle(s.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border text-left active:opacity-80 disabled:opacity-50 ${
                    isInvited ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">{s.name}</div>
                    <div className="text-xs text-gray-400">{s.role}</div>
                  </div>
                  <span className={`text-xs font-semibold ${isInvited ? 'text-green-600' : 'text-gray-400'}`}>
                    {isInvited ? 'Invited ✓' : 'Invite'}
                  </span>
                </button>
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
