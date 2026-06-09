'use client'

import BackButton from '@/app/components/BackButton'
import PageTransition from '@/app/components/PageTransition'

export default function ChecklistDetailClient() {
  return (
    <PageTransition>
      <main className="min-h-screen bg-gray-50">
        <div className="bg-white px-4 py-3 flex items-center gap-3 border-b sticky top-0 z-10">
          <BackButton href="/checklist" />
          <span className="font-semibold text-base">Checklist Detail</span>
        </div>

        <div className="px-4 py-4 pb-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
            <div className="text-4xl mb-3">📋</div>
            <div className="text-sm font-semibold text-gray-700 mb-1">
              Checklist Instance View
            </div>
            <div className="text-xs text-gray-400">
              Not yet implemented — completion workflow coming in next phase
            </div>
          </div>

          <div className="bg-blue-50 rounded-2xl p-4 mt-4">
            <div className="text-xs text-blue-500">
              Instance detail will show checklist items with pass/fail/skip responses. Coming in Phase 2.
            </div>
          </div>
        </div>
      </main>
    </PageTransition>
  )
}
