import { requireCurrentStaff } from '@/lib/auth/currentStaff'
import { canCloseShift } from '@/lib/cashier/permissions'
import { redirect } from 'next/navigation'
import BackButton from '@/app/components/BackButton'
import PageTransition from '@/app/components/PageTransition'

export const dynamic = 'force-dynamic'

export default async function CashierSettingsPage() {
  const staff = await requireCurrentStaff()

  // Settings management requires elevated access
  if (!canCloseShift(staff.role)) {
    redirect('/access-denied')
  }

  return (
    <PageTransition>
      <main className="min-h-screen bg-gray-50">
        <div className="bg-white px-4 py-3 flex items-center gap-3 border-b sticky top-0 z-10">
          <BackButton href="/cashier" />
          <span className="font-semibold text-base">Cashier Settings</span>
        </div>

        <div className="px-4 py-4 pb-8 space-y-4">
          {/* Default Opening Balance */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="text-sm font-semibold text-gray-700 mb-3">
              Default Opening Balance
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Float amount at shift start</span>
              <span className="text-sm font-semibold text-gray-300">RM —</span>
            </div>
          </div>

          {/* Cash Count Requirement */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="text-sm font-semibold text-gray-700 mb-3">
              Cash Count on Closing
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Require physical cash count</span>
              <span className="text-sm text-gray-300">—</span>
            </div>
          </div>

          {/* Max Cash Difference */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="text-sm font-semibold text-gray-700 mb-3">
              Maximum Cash Difference
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Max allowed before flagging</span>
              <span className="text-sm font-semibold text-gray-300">RM —</span>
            </div>
          </div>

          {/* Payment Methods */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="text-sm font-semibold text-gray-700 mb-3">
              Payment Methods
            </div>
            <div className="space-y-2">
              {['Cash', 'Card', 'E-Wallet', 'Bank Transfer'].map(method => (
                <div
                  key={method}
                  className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
                >
                  <span className="text-sm text-gray-500">{method}</span>
                  <span className="text-sm text-gray-300">—</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 rounded-2xl p-4">
            <div className="text-xs text-blue-500">
              Cashier settings will be editable after database tables are implemented. Coming in the next phase.
            </div>
          </div>
        </div>
      </main>
    </PageTransition>
  )
}
