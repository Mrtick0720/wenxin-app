'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { STORE_LOCATION, distanceToStore, formatDistance } from '@/lib/attendance/geo'
import { useGeofence } from './useGeofence'

type Props = {
  staffUserId: string
  businessDate: string
  hasOpenSession: boolean
  openSince: string | null
  onChanged: () => void | Promise<void>
}

const OUTSIDE_MSG = 'You are outside the allowed attendance area.'
const DENIED_MSG = 'Location permission is required to record attendance.'

export default function ClockInOutCard({
  staffUserId, businessDate, hasOpenSession, openSince, onChanged,
}: Props) {
  const geo = useGeofence()
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canAct = geo.status === 'ready' && !actionLoading

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-MY', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kuching',
    })
  }

  // Re-validate location at the moment of action, then run `op`, then stamp the
  // affected session row with the GPS reading.
  async function withGeofence(op: () => Promise<void>) {
    setError(null)
    setActionLoading(true)
    try {
      let coords
      try {
        coords = await geo.capture()
      } catch (reason) {
        setError(reason === 'denied' ? DENIED_MSG : 'Could not get your location. Try again.')
        return null
      }
      const distance = distanceToStore(coords.latitude, coords.longitude)
      if (distance > STORE_LOCATION.allowedRadius) {
        setError(OUTSIDE_MSG)
        return null
      }
      await op()
      return { coords, distance }
    } finally {
      setActionLoading(false)
    }
  }

  async function handleClockIn() {
    const result = await withGeofence(async () => {
      const { error: rpcError } = await supabase.rpc('clock_in_attendance', {
        _staff_user_id: staffUserId,
        _business_date: businessDate,
      })
      if (rpcError) throw new Error(rpcError.message)
    }).catch((e: Error) => { setError(e.message); return null })

    if (!result) return

    // Stamp the just-opened session with the clock-in location.
    const { data: rows } = await supabase
      .from('attendance_sessions')
      .select('id')
      .eq('staff_user_id', staffUserId)
      .eq('business_date', businessDate)
      .is('clock_out', null)
      .order('clock_in', { ascending: false })
      .limit(1)
    const id = rows?.[0]?.id
    if (id) {
      await supabase.from('attendance_sessions').update({
        clock_in_latitude: result.coords.latitude,
        clock_in_longitude: result.coords.longitude,
        clock_in_accuracy: result.coords.accuracy,
        clock_in_distance: result.distance,
      }).eq('id', id)
    }
    await onChanged()
  }

  async function handleClockOut() {
    const result = await withGeofence(async () => {
      const { error: rpcError } = await supabase.rpc('clock_out_attendance', {
        _staff_user_id: staffUserId,
      })
      if (rpcError) throw new Error(rpcError.message)
    }).catch((e: Error) => { setError(e.message); return null })

    if (!result) return

    // Stamp the just-closed session with the clock-out location.
    const { data: rows } = await supabase
      .from('attendance_sessions')
      .select('id')
      .eq('staff_user_id', staffUserId)
      .eq('business_date', businessDate)
      .not('clock_out', 'is', null)
      .order('clock_out', { ascending: false })
      .limit(1)
    const id = rows?.[0]?.id
    if (id) {
      await supabase.from('attendance_sessions').update({
        clock_out_latitude: result.coords.latitude,
        clock_out_longitude: result.coords.longitude,
        clock_out_accuracy: result.coords.accuracy,
        clock_out_distance: result.distance,
      }).eq('id', id)
    }
    await onChanged()
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
      <div className="text-5xl mb-4">{hasOpenSession ? '🟢' : '⏰'}</div>

      {hasOpenSession ? (
        <>
          <div className="text-sm font-semibold text-green-600 mb-1">Clocked In</div>
          {openSince && (
            <div className="text-xs text-gray-400 mb-4">Since {formatTime(openSince)}</div>
          )}
        </>
      ) : (
        <>
          <div className="text-sm font-semibold text-gray-700 mb-1">Not Clocked In</div>
          <div className="text-xs text-gray-400 mb-4">Start your shift</div>
        </>
      )}

      <GeofenceStatus geo={geo} />

      {error && (
        <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
      )}

      {hasOpenSession ? (
        <button
          onClick={handleClockOut}
          disabled={!canAct}
          className="w-full py-3 bg-orange-500 text-white rounded-xl text-sm font-semibold disabled:opacity-40"
        >
          {actionLoading ? 'Clocking Out…' : 'Clock Out'}
        </button>
      ) : (
        <button
          onClick={handleClockIn}
          disabled={!canAct}
          className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-semibold disabled:opacity-40"
        >
          {actionLoading ? 'Clocking In…' : 'Clock In'}
        </button>
      )}
    </div>
  )
}

function GeofenceStatus({ geo }: { geo: ReturnType<typeof useGeofence> }) {
  if (geo.status === 'locating') {
    return (
      <div className="mb-4 flex items-center justify-center gap-2 text-sm text-gray-400">
        <span className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 border-t-gray-500 animate-spin" />
        Locating…
      </div>
    )
  }

  if (geo.status === 'denied') {
    return (
      <div className="mb-4">
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{DENIED_MSG}</div>
        <button onClick={geo.refresh} className="mt-2 text-xs font-medium text-orange-500 active:opacity-70">
          Try again
        </button>
      </div>
    )
  }

  if (geo.status === 'error') {
    return (
      <div className="mb-4">
        <div className="text-sm text-gray-500">Couldn&apos;t get your location.</div>
        <button onClick={geo.refresh} className="mt-2 px-4 py-1.5 rounded-lg bg-gray-100 text-xs font-semibold text-gray-700 active:bg-gray-200">
          Retry
        </button>
      </div>
    )
  }

  // ready | outside — we have a distance to show.
  const inside = geo.status === 'ready'
  return (
    <div className="mb-4 rounded-xl bg-gray-50 px-4 py-3">
      <div className="text-xs text-gray-400">Restaurant Distance</div>
      <div className={`text-2xl font-bold leading-tight mt-0.5 ${inside ? 'text-gray-900' : 'text-red-500'}`}>
        {geo.distance !== null ? formatDistance(geo.distance) : '—'}
      </div>
      <div className="mt-1 flex items-center justify-center gap-2">
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${inside ? 'text-green-600' : 'text-red-500'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${inside ? 'bg-green-500' : 'bg-red-500'}`} />
          {inside ? 'GPS Ready' : 'Outside Attendance Area'}
        </span>
        {geo.coords && (
          <span className="text-[11px] text-gray-300">±{Math.round(geo.coords.accuracy)} m</span>
        )}
      </div>
      {inside && (
        <button onClick={geo.refresh} className="mt-1.5 text-[11px] text-gray-400 active:opacity-70">
          Refresh location
        </button>
      )}
    </div>
  )
}
