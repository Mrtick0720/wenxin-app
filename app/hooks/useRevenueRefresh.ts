'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

export interface RevenueRefreshDaily {
  revenueTotal: number | null
  revenueYesterday: number | null
  growthPercent: number | null
}

export interface RevenueRefreshMtd {
  mtdRevenue: number | null
  mtdAverage: number | null
  bestDayRevenue: number | null
}

interface RevenueRefreshResponse {
  ok: boolean
  fetchedAt: string
  daily: RevenueRefreshDaily
  mtd: RevenueRefreshMtd
}

interface RevenueRefreshState {
  daily: RevenueRefreshDaily | null
  mtd: RevenueRefreshMtd | null
  fetchedAt: string | null
}

const REFRESH_INTERVAL_MS = 60_000
const FETCH_TIMEOUT_MS = 10_000

/**
 * Polls /api/feedme/revenue-refresh every 60 seconds.
 *
 * - Only one timer exists.
 * - Timer is cleaned up on unmount.
 * - Prevents overlapping requests: if a fetch is already in-flight, the next
 *   cycle is skipped.
 * - On fetch failure, existing displayed values are preserved (never blanked).
 * - No loading spinner — values update seamlessly in the background.
 */
export function useRevenueRefresh(): RevenueRefreshState {
  const [data, setData] = useState<RevenueRefreshState>({
    daily: null,
    mtd: null,
    fetchedAt: null,
  })

  // Ref to prevent overlapping requests
  const fetchingRef = useRef(false)
  // Ref to hold the latest data for the interval callback (avoids stale closure)
  const dataRef = useRef(data)
  dataRef.current = data

  const fetchRevenue = useCallback(async () => {
    // Prevent overlapping requests
    if (fetchingRef.current) return
    fetchingRef.current = true

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

      const res = await fetch('/api/feedme/revenue-refresh', {
        signal: controller.signal,
        cache: 'no-store',
      })

      clearTimeout(timer)

      if (!res.ok) return

      const json: RevenueRefreshResponse = await res.json()
      if (!json.ok) return

      setData({
        daily: json.daily,
        mtd: json.mtd,
        fetchedAt: json.fetchedAt,
      })
    } catch {
      // Silently ignore — keep existing displayed values
    } finally {
      fetchingRef.current = false
    }
  }, [])

  useEffect(() => {
    // Initial fetch on mount (after a short delay to not compete with SSR)
    const initialTimer = setTimeout(() => {
      fetchRevenue()
    }, 10_000)

    // Set up periodic refresh
    const interval = setInterval(() => {
      fetchRevenue()
    }, REFRESH_INTERVAL_MS)

    return () => {
      clearTimeout(initialTimer)
      clearInterval(interval)
    }
  }, [fetchRevenue])

  return data
}
