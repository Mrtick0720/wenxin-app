'use client'

// ── Kitchen Tasks — owner/manager publishing surface ──
// Owner/manager create and manage the kitchen's daily work here (with urgency
// and recurring-routine attributes). The kitchen sees the same list read-only
// on its Home and just ticks items done. Reuses KitchenDailyTasks(canManage).

import { useState, useEffect } from 'react'
import BackButton from '../components/BackButton'
import PageTransition from '../components/PageTransition'
import KitchenDailyTasks from '../components/home/KitchenDailyTasks'
import { listKitchenTasksAction, type KitchenTask } from '../kitchen/dailyTasksActions'

export default function KitchenTasksPage() {
  const [tasks, setTasks] = useState<KitchenTask[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    listKitchenTasksAction().then(res => {
      if (!active) return
      if (res.ok) setTasks(res.data)
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  return (
    <PageTransition>
    <main className="bg-gray-50 w-full mx-auto min-h-screen">
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center gap-3 border-b sticky top-0 z-10">
        <BackButton href="/" />
        <span className="font-semibold text-base">Kitchen Tasks</span>
      </div>

      <div className="px-4 pt-4 pb-28">
        <p className="text-xs text-gray-400 mb-3 px-1">
          Publish today&apos;s work for the kitchen. Set urgency and mark routines that repeat every day.
        </p>
        {loading ? (
          <div className="h-32 animate-pulse rounded-2xl bg-white" />
        ) : (
          <KitchenDailyTasks initialTasks={tasks} canManage />
        )}
      </div>
    </main>
    </PageTransition>
  )
}
