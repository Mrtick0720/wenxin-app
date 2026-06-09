'use client'

import BackButton from '@/app/components/BackButton'
import PageTransition from '@/app/components/PageTransition'
import { useStaff } from '@/app/components/StaffProvider'
import {
  canOperateCashier,
  canCloseShift,
  getCashierActionsForRole,
} from '@/lib/cashier/permissions'
import type { CurrentStaff } from '@/lib/auth/types'

export default function CashierClient({ staff }: { staff: CurrentStaff }) {
  const clientStaff = useStaff()
  const role = clientStaff?.role ?? staff.role
  const allowedActions = getCashierActionsForRole(role)

  return (
    <PageTransition>
      <main className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white px-4 py-3 flex items-center justify-between border-b sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <BackButton href="/" />
            <span className="font-semibold text-base">Cashier</span>
          </div>
        </div>

        <div className="px-4 py-4 pb-8 space-y-4">
          {/* Status Card */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="text-sm text-gray-500 mb-3">Cashier Status</div>

            {allowedActions.includes('open_shift') && (
              <div className="text-center py-4">
                <div className="text-4xl mb-3">💰</div>
                <div className="text-sm font-semibold text-gray-700 mb-1">
                  No Active Shift
                </div>
                <div className="text-xs text-gray-400 mb-4">
                  Open a shift to start recording payments
                </div>
                <button
                  disabled
                  className="px-6 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-semibold opacity-50 cursor-not-allowed"
                >
                  Open Shift
                </button>
              </div>
            )}

            {!allowedActions.includes('open_shift') && (
              <div className="text-center py-4">
                <div className="text-sm text-gray-400">
                  Not yet implemented
                </div>
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Today\'s Shifts', value: '—' },
              { label: 'Active Shift', value: '—' },
              { label: 'Total Cash', value: '—' },
            ].map(stat => (
              <div
                key={stat.label}
                className="bg-white rounded-2xl p-3 shadow-sm text-center"
              >
                <div className="text-lg font-bold text-gray-300">
                  {stat.value}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="text-sm font-semibold text-gray-700 mb-3">
              Actions
            </div>
            <div className="space-y-2">
              {allowedActions.includes('record_payment') && (
                <button
                  disabled
                  className="w-full py-2.5 bg-gray-100 text-gray-400 rounded-xl text-sm font-medium cursor-not-allowed text-left px-4"
                >
                  💳 Record Payment
                </button>
              )}
              {allowedActions.includes('make_adjustment') && (
                <button
                  disabled
                  className="w-full py-2.5 bg-gray-100 text-gray-400 rounded-xl text-sm font-medium cursor-not-allowed text-left px-4"
                >
                  📝 Make Adjustment
                </button>
              )}
              {allowedActions.includes('close_shift') && (
                <button
                  disabled
                  className="w-full py-2.5 bg-gray-100 text-gray-400 rounded-xl text-sm font-medium cursor-not-allowed text-left px-4"
                >
                  🔒 Close Shift
                </button>
              )}
              {allowedActions.includes('view_reports') && (
                <a
                  href="/cashier/reports"
                  className="block w-full py-2.5 bg-gray-100 text-gray-400 rounded-xl text-sm font-medium text-left px-4"
                >
                  📊 View Reports
                </a>
              )}
              {allowedActions.includes('manage_settings') && (
                <a
                  href="/cashier/settings"
                  className="block w-full py-2.5 bg-gray-100 text-gray-400 rounded-xl text-sm font-medium text-left px-4"
                >
                  ⚙️ Cashier Settings
                </a>
              )}
            </div>
          </div>

          {/* Not Yet Implemented Banner */}
          <div className="bg-blue-50 rounded-2xl p-4">
            <div className="text-xs text-blue-500">
              Cashier module foundation is in place. Database tables, payment recording, and shift management are coming in the next phase.
            </div>
          </div>
        </div>
      </main>
    </PageTransition>
  )
}
