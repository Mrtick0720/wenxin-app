'use client'

import BackButton from '@/app/components/BackButton'
import PageTransition from '@/app/components/PageTransition'
import { useStaff } from '@/app/components/StaffProvider'
import { canManageTemplates } from '@/lib/checklist/permissions'
import type { CurrentStaff } from '@/lib/auth/types'

export default function ChecklistClient({
  staff,
  isManager,
}: {
  staff: CurrentStaff
  isManager: boolean
}) {
  const clientStaff = useStaff()
  const role = clientStaff?.role ?? staff.role
  const showTemplates = canManageTemplates(role)

  return (
    <PageTransition>
      <main className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white px-4 py-3 flex items-center justify-between border-b sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <BackButton href="/" />
            <span className="font-semibold text-base">Checklist</span>
          </div>
          <div className="flex items-center gap-2">
            {showTemplates && (
              <a
                href="/checklist/templates"
                className="rounded-md bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-gray-600"
              >
                Templates
              </a>
            )}
            {isManager && (
              <span className="text-xs text-gray-400">Manager View</span>
            )}
          </div>
        </div>

        <div className="px-4 py-4 pb-8 space-y-4">
          {/* Today's Checklist Board */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="text-sm font-semibold text-gray-700 mb-3">
              Today&apos;s Checklists
            </div>
            <div className="text-center text-gray-400 py-8 text-sm">
              <div className="text-4xl mb-3">✅</div>
              <div className="font-medium text-gray-500 mb-1">
                Checklist board loading...
              </div>
              <div className="text-xs">
                Connect to database to view today&apos;s checklist instances
              </div>
            </div>
          </div>

          {/* Status Summary */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Pending', color: 'text-gray-400', value: '—' },
              { label: 'In Progress', color: 'text-orange-500', value: '—' },
              { label: 'Completed', color: 'text-green-500', value: '—' },
            ].map(stat => (
              <div
                key={stat.label}
                className="bg-white rounded-2xl p-3 shadow-sm text-center"
              >
                <div className={`text-lg font-bold ${stat.color}`}>
                  {stat.value}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {/* Template List */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="text-sm font-semibold text-gray-700 mb-3">
              Checklist Types
            </div>
            <div className="space-y-2">
              {[
                { name: 'Opening Checklist', type: 'opening', time: '08:00', role: 'Kitchen' },
                { name: 'Kitchen Hygiene', type: 'kitchen_hygiene', time: '10:00 / 16:00', role: 'Kitchen' },
                { name: 'Stock Check', type: 'stock_check', time: '09:00', role: 'Kitchen' },
                { name: 'Cash Closing', type: 'cash_closing', time: '21:00', role: 'Front Desk' },
                { name: 'Closing Checklist', type: 'closing', time: '21:00', role: 'Kitchen' },
              ].map(t => (
                <div
                  key={t.type}
                  className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
                >
                  <div>
                    <div className="text-sm font-medium text-gray-800">
                      {t.name}
                    </div>
                    <div className="text-xs text-gray-400">
                      {t.time} · {t.role}
                    </div>
                  </div>
                  <span className="text-xs text-gray-300">—</span>
                </div>
              ))}
            </div>
          </div>

          {/* Correction placeholder (Manager/Owner) */}
          {isManager && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="text-sm font-semibold text-gray-700 mb-3">
                Verification Queue
              </div>
              <div className="text-center text-gray-400 py-4 text-sm">
                Completed checklists pending verification will appear here
              </div>
            </div>
          )}

          <div className="bg-blue-50 rounded-2xl p-4">
            <div className="text-xs text-blue-500">
              Checklist module foundation in place. Instance completion, verification workflow, and incident/task generation are coming in the next phase.
            </div>
          </div>
        </div>
      </main>
    </PageTransition>
  )
}
