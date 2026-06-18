'use client'

import { useEffect, useRef, useCallback } from 'react'

type RefreshFn = () => Promise<void> | void

/**
 * Cross-device sync hook for Purchase data.
 *
 * Provides:
 * 1. Active-tab polling every 8 seconds
 * 2. Refetch on `visibilitychange` (tab/window focus)
 * 3. Refetch on `online` event (network reconnect)
 *
 * Designed to be called once in PurchaseClient. The refresh function is
 * idempotent — it will not fire while a previous refresh is in flight.
 */
export function usePurchaseSync(refresh: RefreshFn) {
  const refreshRef = useRef<RefreshFn>(refresh)
  refreshRef.current = refresh

  const refreshingRef = useRef(false)
  const safeRefresh = useCallback(async () => {
    if (refreshingRef.current) return
    refreshingRef.current = true
    try {
      await refreshRef.current()
    } finally {
      refreshingRef.current = false
    }
  }, [])

  useEffect(() => {
    // ── Polling ──
    const interval = setInterval(() => {
      safeRefresh()
    }, 8_000)

    // ── Visibility change ──
    function onVisibility() {
      if (document.visibilityState === 'visible') {
        safeRefresh()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    // ── Online / reconnect ──
    function onOnline() {
      safeRefresh()
    }
    window.addEventListener('online', onOnline)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('online', onOnline)
    }
  }, [safeRefresh])
}
