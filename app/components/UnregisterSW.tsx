'use client'

import { useEffect } from 'react'

/**
 * Unregister any stale service workers — prevents iOS PWA cache
 * from serving outdated JS after a redeploy.
 */
export default function UnregisterSW() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(r => r.unregister())
    }).catch(() => { /* ignore */ })
  }, [])
  return null
}
