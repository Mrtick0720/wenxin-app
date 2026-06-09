import { requireCurrentStaff } from '@/lib/auth/currentStaff'
import { canViewCashier } from '@/lib/cashier/permissions'
import { redirect } from 'next/navigation'
import BackButton from '@/app/components/BackButton'
import PageTransition from '@/app/components/PageTransition'

export const dynamic = 'force-dynamic'

export default async function CashierReportsPage() {
  const staff = await requireCurrentStaff()

  if (!canViewCashier(staff.role)) {
    redirect('/access-denied')
  }

  return (
    <PageTransition>
      <main className="min-h-screen bg-gray-50">
        <div className="bg-white px-4 py-3 flex items-center gap-3 border-b sticky top-0 z-10">
          <BackButton href="/cashier" />
          <span className="font-semibold text-base">Cashier Reports</span>
        </div>

        <div className="px-4 py-4 pb-8 space-y-4">
          <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
            <div className="text-4xl mb-3">📊</div>
            <div className="text-sm font-semibold text-gray-700 mb-1">
              Cashier Reports
            </div>
            <div className="text-xs text-gray-400">
              Not yet implemented — database migration required
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {[
              { label: 'Daily Cash Summary', desc: 'Today\'s shift totals and payment breakdown', icon: '📅' },
              { label: 'Shift History', desc: 'All closed and audited shifts', icon: '📋' },
              { label: 'Payment Method Report', desc: 'Breakdown by payment type', icon: '💳' },
              { label: 'Adjustment Log', desc: 'All pay-ins, pay-outs, and corrections', icon: '📝' },
            ].map(({ label, desc, icon }) => (
              <div
                key={label}
                className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-4 opacity-50"
              >
                <div className="text-2xl">{icon}</div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    {label}
                  </div>
                  <div className="text-xs text-gray-400">{desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 rounded-2xl p-4">
            <div className="text-xs text-blue-500">
              Cashier reports will be available after database tables and shift recording are implemented.
            </div>
          </div>
        </div>
      </main>
    </PageTransition>
  )
}
