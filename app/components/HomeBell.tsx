'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useStaff } from '@/app/components/StaffProvider'
import { fetchUpcomingReservationsAction, type FullReservation } from '@/app/reservations/actions'
import { useReservationsRealtime } from '@/app/reservations/useReservationsRealtime'

type UpcomingEntry = {
  id: number
  customer_name?: string
  time_start: string
  pax: number
  table_area: string | null
}

const Z_MAX = 2147483647

function fmtTime(t: string): string { return t.slice(0, 5) }

export default function HomeBell({ baseCount }: { baseCount: number }) {
  const staff = useStaff()
  // Normalize as a plain string so a legacy 'boss' value (removed from the role
  // enum) still maps to owner without a no-overlap type error on the comparison.
  const rawRole: string = staff?.role ?? 'other'
  const role = rawRole === 'boss' ? 'owner' : rawRole
  const canSeePii = role === 'owner' || role === 'manager' || role === 'front_desk'

  const [upcoming, setUpcoming] = useState<UpcomingEntry[]>([])
  const [showSheet, setShowSheet] = useState(false)

  const load = useCallback(async () => {
    const res = await fetchUpcomingReservationsAction()
    if (res.ok) {
      setUpcoming(res.data.reservations.map(r => ({
        id: r.id,
        customer_name: (r as FullReservation).customer_name,
        time_start: r.time_start,
        pax: r.pax,
        table_area: r.table_area,
      })))
    }
  }, [])

  useEffect(() => {
    async function refresh() { await load() }
    refresh()
  }, [load])

  // Realtime — refresh upcoming count when reservations change
  useReservationsRealtime(() => { load() })

  const upcomingCount = upcoming.length
  const totalCount = baseCount + upcomingCount

  return (
    <>
      <button type="button" onClick={() => setShowSheet(true)} className="relative">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 01-3.46 0"/>
        </svg>
        {totalCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full min-w-[16px] h-4 px-0.5 flex items-center justify-center leading-none">
            {totalCount}
          </span>
        )}
      </button>

      {/* Notification sheet */}
      {showSheet && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed flex flex-col justify-end"
          style={{ top: 0, left: 0, right: 0, bottom: 0, zIndex: Z_MAX, background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setShowSheet(false)}
        >
          <div
            className="bg-white rounded-t-3xl max-h-[70vh] flex flex-col"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-4 pt-5 pb-3 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
              <span className="font-semibold text-base">Notifications</span>
              <button type="button" onClick={() => setShowSheet(false)} className="text-gray-400 text-2xl leading-none">×</button>
            </div>

            <div className="overflow-y-auto flex-1 min-h-0 px-4 py-3 space-y-3">
              {/* Upcoming reservations */}
              {upcoming.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Upcoming Reservations</div>
                  {upcoming.map(r => (
                    <div key={r.id} className="bg-orange-50 rounded-xl px-4 py-3 mb-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-gray-900">
                          {canSeePii && r.customer_name ? r.customer_name : `Reservation #${r.id}`}
                        </span>
                        <span className="text-sm font-bold text-orange-500 tabular-nums">{fmtTime(r.time_start)}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {r.pax} pax{r.table_area ? ` · ${r.table_area}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {upcoming.length === 0 && (
                <div className="py-8 text-center text-sm text-gray-400">No upcoming reservations</div>
              )}
            </div>

            <div className="flex-shrink-0 border-t border-gray-100 px-4 pt-3">
              <button type="button" onClick={() => setShowSheet(false)}
                className="w-full py-3 rounded-2xl text-sm font-semibold bg-gray-100 text-gray-600 active:opacity-80">
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
