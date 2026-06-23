'use client'

import { lazy, Suspense, useState, useEffect } from 'react'
import BackButton from '../components/BackButton'
import KitchenTasksWithPolling from '../components/home/KitchenTasksWithPolling'
import { listKitchenTasksAction, type KitchenTask } from '../kitchen/dailyTasksActions'
import { useNavigation } from '../components/NavigationStack'
import { FullPageSpinner } from '../components/Spinner'

const NewKitchenTaskPage = lazy(() => import('./new/page'))

export default function KitchenTasksPage() {
  const { push } = useNavigation()
  const [tasks, setTasks] = useState<KitchenTask[]>([])
  const [loading, setLoading] = useState(true)

  function reload() {
    listKitchenTasksAction().then(res => {
      if (res.ok) setTasks(res.data)
      setLoading(false)
    })
  }

  useEffect(() => {
    reload()
  }, [])

  const done = tasks.filter(t => t.done).length
  const urgent = tasks.filter(t => !t.done && t.urgency > 0).length

  if (loading) return <FullPageSpinner />

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#f9fafb', overflow: 'hidden' }}>
      <div className="bg-white px-4 py-3 flex items-center gap-3 border-b" style={{ flexShrink: 0 }}>
        <BackButton href="/" />
        <span className="font-semibold text-base">Kitchen</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 144px)' }}>

        {/* Summary */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="text-sm text-gray-500 mb-3">Today&apos;s Summary</div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-500">{urgent}</div>
              <div className="text-xs text-gray-400 mt-0.5">Urgent</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-500">{tasks.length - done - urgent}</div>
              <div className="text-xs text-gray-400 mt-0.5">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">{done}</div>
              <div className="text-xs text-gray-400 mt-0.5">Done</div>
            </div>
          </div>
        </div>

        <div>
          <div className="text-sm font-semibold text-gray-700 mb-2">Task List</div>
          <KitchenTasksWithPolling initialTasks={tasks} canManage />
        </div>
      </div>

      <button
        onClick={() => push('/kitchen-tasks/new', <Suspense fallback={null}><NewKitchenTaskPage onSaved={() => reload()} /></Suspense>)}
        aria-label="New kitchen task"
        className="fixed z-[290] w-14 h-14 rounded-full flex items-center justify-center shadow-lg active:opacity-80"
        style={{ background: '#f97316', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)', left: '50%', transform: 'translateX(-50%)' }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  )
}
