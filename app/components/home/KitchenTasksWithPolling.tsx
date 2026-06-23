'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import KitchenDailyTasks from './KitchenDailyTasks'
import { listKitchenTasksAction, type KitchenTask } from '@/app/kitchen/dailyTasksActions'

const POLL_INTERVAL = 8000

export default function KitchenTasksWithPolling({
  initialTasks,
  canManage = false,
}: {
  initialTasks: KitchenTask[]
  canManage?: boolean
}) {
  const [tasks, setTasks] = useState<KitchenTask[]>(initialTasks)
  const suppressUntilRef = useRef(0)

  const silentReload = useCallback(async () => {
    if (Date.now() < suppressUntilRef.current) return
    const res = await listKitchenTasksAction()
    if (res.ok) setTasks(res.data)
  }, [])

  // Suppress reload briefly after local toggle to avoid flicker
  function suppress() {
    suppressUntilRef.current = Date.now() + 3000
  }

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') silentReload()
    }, POLL_INTERVAL)
    const onVisible = () => { if (document.visibilityState === 'visible') silentReload() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible) }
  }, [silentReload])

  return (
    <KitchenDailyTasks
      initialTasks={tasks}
      canManage={canManage}
      showComposer={canManage}
      onOptimisticUpdate={suppress}
    />
  )
}
