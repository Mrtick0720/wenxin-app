'use client'

import BackButton from '../components/BackButton'
import PageTransition from '../components/PageTransition'

const records = [
  { id: 1, type: 'Revenue', category: 'Dine-in', amount: 1280, date: '2026-06-05', note: 'Lunch + Dinner' },
  { id: 2, type: 'Revenue', category: 'Bento', amount: 912, date: '2026-06-05', note: '38 orders' },
  { id: 3, type: 'Expense', category: 'Ingredients', amount: -450, date: '2026-06-05', note: 'Likas Market' },
  { id: 4, type: 'Expense', category: 'Utilities', amount: -120, date: '2026-06-05', note: 'Electricity bill' },
  { id: 5, type: 'Expense', category: 'Staff', amount: -380, date: '2026-06-05', note: 'Daily wages' },
]

export default function FinancePage() {
  const totalRevenue = records.filter(r => r.type === 'Revenue').reduce((s, r) => s + r.amount, 0)
  const totalExpense = records.filter(r => r.type === 'Expense').reduce((s, r) => s + r.amount, 0)
  const net = totalRevenue + totalExpense

  return (
    <PageTransition>
    <main className="bg-gray-50 w-full mx-auto">
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <BackButton href="/" />
          <span className="font-semibold text-base">Finance</span>
        </div>
        <span className="text-xs text-gray-400">Today</span>
      </div>

      <div className="px-4 py-4 pb-8 space-y-4">
        {/* Summary */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="text-sm text-gray-500 mb-3">Today&apos;s Summary</div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="text-xl font-bold text-green-500">RM {totalRevenue.toLocaleString()}</div>
              <div className="text-xs text-gray-400 mt-0.5">Revenue</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-red-500">RM {Math.abs(totalExpense).toLocaleString()}</div>
              <div className="text-xs text-gray-400 mt-0.5">Expenses</div>
            </div>
            <div className="text-center">
              <div className={`text-xl font-bold ${net >= 0 ? 'text-gray-900' : 'text-red-500'}`}>RM {net.toLocaleString()}</div>
              <div className="text-xs text-gray-400 mt-0.5">Net</div>
            </div>
          </div>
        </div>

        {/* Records */}
        <div>
          <div className="text-sm font-semibold text-gray-700 mb-2">Today&apos;s Records</div>
          <div className="space-y-2">
            {records.map((r) => (
              <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      r.type === 'Revenue' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                    }`}>
                      {r.type}
                    </span>
                    <span className="text-xs text-gray-400">{r.category}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{r.note}</div>
                </div>
                <span className={`text-sm font-semibold ml-3 ${r.amount >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {r.amount >= 0 ? '+' : ''}RM {r.amount.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-blue-50 rounded-2xl p-4">
          <div className="text-xs text-blue-500">Finance data is currently using sample data. Real data will appear after Supabase integration.</div>
        </div>
      </div>
    </main>
    </PageTransition>
  )
}
