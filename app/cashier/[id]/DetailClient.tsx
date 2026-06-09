'use client'

import BackButton from '@/app/components/BackButton'
import PageTransition from '@/app/components/PageTransition'

export default function ShiftDetailClient() {
  return (
    <PageTransition>
      <main className="min-h-screen bg-gray-50">
        <div className="bg-white px-4 py-3 flex items-center gap-3 border-b sticky top-0 z-10">
          <BackButton href="/cashier" />
          <span className="font-semibold text-base">Shift Detail</span>
        </div>

        <div className="px-4 py-4 pb-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
            <div className="text-4xl mb-3">🧾</div>
            <div className="text-sm font-semibold text-gray-700 mb-1">
              Shift Detail View
            </div>
            <div className="text-xs text-gray-400">
              Not yet implemented — database migration required
            </div>
          </div>

          <div className="bg-blue-50 rounded-2xl p-4 mt-4">
            <div className="text-xs text-blue-500">
              Shift detail will show transactions, adjustments, payment breakdown, and shift summary. Coming in the next phase.
            </div>
          </div>
        </div>
      </main>
    </PageTransition>
  )
}
