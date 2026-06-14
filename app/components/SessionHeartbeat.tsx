'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useStaff } from './StaffProvider'

const HEARTBEAT_INTERVAL = 5 * 60 * 1000

export default function SessionHeartbeat() {
  const staff = useStaff()
  const router = useRouter()

  useEffect(() => {
    if (!staff) return

    let stopped = false

    async function touchSession() {
      if (document.visibilityState !== 'visible') return

      try {
        const response = await fetch('/api/session/heartbeat', {
          method: 'POST',
          cache: 'no-store',
        })

        if (!stopped && response.status === 401) {
          router.replace('/login?reason=session-ended')
          router.refresh()
        }
      } catch {
        // Network changes are retryable; the next heartbeat will try again.
      }
    }

    const timer = window.setInterval(touchSession, HEARTBEAT_INTERVAL)
    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [router, staff])

  return null
}
