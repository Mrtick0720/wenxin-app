'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  STORE_LOCATION,
  distanceToStore,
  getCurrentCoords,
  type Coords,
  type GeoError,
} from '@/lib/attendance/geo'

export type GeofenceStatus =
  | 'locating'   // waiting for a fix
  | 'ready'      // have a fix, inside the radius
  | 'outside'    // have a fix, outside the radius
  | 'denied'     // permission denied
  | 'error'      // signal unavailable / timeout / unsupported

export type Geofence = {
  status: GeofenceStatus
  coords: Coords | null
  distance: number | null      // metres from the restaurant
  withinRadius: boolean
  /** Re-request a fresh position (e.g. retry button). */
  refresh: () => void
  /**
   * Fetch a fresh fix on demand (used at clock-in/out time to validate at the
   * moment of action). Updates state too. Rejects with a GeoError.
   */
  capture: () => Promise<Coords>
}

/**
 * Manages a one-shot GPS read against the store geofence and exposes derived
 * status for the UI. Reads once on mount; `refresh()` re-reads.
 */
export function useGeofence(): Geofence {
  const [coords, setCoords] = useState<Coords | null>(null)
  const [status, setStatus] = useState<GeofenceStatus>('locating')
  const activeRef = useRef(true)

  const read = useCallback(async () => {
    setStatus('locating')
    try {
      const c = await getCurrentCoords()
      if (!activeRef.current) return c
      setCoords(c)
      const d = distanceToStore(c.latitude, c.longitude)
      setStatus(d <= STORE_LOCATION.allowedRadius ? 'ready' : 'outside')
      return c
    } catch (e) {
      if (!activeRef.current) throw e
      setStatus((e as GeoError) === 'denied' ? 'denied' : 'error')
      throw e
    }
  }, [])

  useEffect(() => {
    activeRef.current = true
    read()
    return () => { activeRef.current = false }
  }, [read])

  const distance = coords ? distanceToStore(coords.latitude, coords.longitude) : null
  const withinRadius = distance !== null && distance <= STORE_LOCATION.allowedRadius

  return {
    status,
    coords,
    distance,
    withinRadius,
    refresh: () => { read().catch(() => {}) },
    capture: read,
  }
}
