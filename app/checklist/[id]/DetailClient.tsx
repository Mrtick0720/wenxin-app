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

        <div className="px-4 py-4 pb-8 space-y-4">
          {/* Instance Header */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-800">
                Checklist Instance
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">
                In Progress
              </span>
            </div>
            <div className="text-xs text-gray-400">
              Scheduled: 08:00 · Assigned: Kitchen
            </div>
          </div>

          {/* Items */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="text-sm font-semibold text-gray-700 mb-3">
              Items
            </div>

            {/* Example items to show UI structure */}
            {[
              { id: 1, cat: 'Equipment', desc: 'All gas burners functioning', critical: true },
              { id: 2, cat: 'Equipment', desc: 'Rice cookers operational', critical: true },
              { id: 3, cat: 'Hygiene', desc: 'Kitchen surfaces sanitized', critical: true },
              { id: 4, cat: 'Hygiene', desc: 'Hand washing station stocked', critical: false },
            ].map(item => (
              <div
                key={item.id}
                className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {item.critical && (
                      <span className="text-[10px] px-1 py-0.5 rounded bg-red-50 text-red-500 font-medium">
                        Critical
                      </span>
                    )}
                    <span className="text-[10px] text-gray-400">{item.cat}</span>
                  </div>
                  <div className="text-sm text-gray-700">{item.desc}</div>
                </div>

                {/* Response Buttons */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    disabled
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-400 cursor-not-allowed"
                  >
                    Pass
                  </button>
                  <button
                    disabled
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-400 cursor-not-allowed"
                  >
                    Fail
                  </button>
                  <button
                    disabled
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-400 cursor-not-allowed"
                  >
                    N/A
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Complete Button */}
          <button
            disabled
            className="w-full py-3 bg-orange-500 text-white rounded-xl text-sm font-semibold opacity-50 cursor-not-allowed"
          >
            Complete Checklist
          </button>

          {/* Manager Verification */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="text-sm font-semibold text-gray-700 mb-3">
              Verification (Manager)
            </div>
            <div className="flex gap-2">
              <button
                disabled
                className="flex-1 py-2.5 bg-green-500 text-white rounded-xl text-sm font-medium opacity-50 cursor-not-allowed"
              >
                ✓ Approve
              </button>
              <button
                disabled
                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium opacity-50 cursor-not-allowed"
              >
                ✗ Reject
              </button>
            </div>
            <div className="mt-2 text-center text-xs text-gray-400">
              Verification requires database connection
            </div>
          </div>

          <div className="bg-blue-50 rounded-2xl p-4">
            <div className="text-xs text-blue-500">
              Response workflow service layer is implemented. Pass/Fail/N/A buttons, completion, verification, and incident/task generation are wire-ready for live database integration.
            </div>
          </div>
        </div>
      </main>
    </PageTransition>
  )
}
