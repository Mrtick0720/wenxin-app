'use client'

import BackButton from '../components/BackButton'
import PageTransition from '../components/PageTransition'

export default function ReportsPage() {
  return (
    <PageTransition>
    <main className="bg-gray-50 w-full mx-auto">
      <div className="bg-white px-4 py-3 flex items-center gap-3 border-b sticky top-0 z-10">
        <BackButton href="/" />
        <span className="font-semibold text-base">Reports</span>
      </div>

      <div className="px-4 py-4 pb-8 space-y-4">
        <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
          <div className="text-4xl mb-3">📊</div>
          <div className="text-sm font-semibold text-gray-700 mb-1">Reports & Analytics</div>
          <div className="text-xs text-gray-400">Revenue trends, order analytics, and business insights coming soon.</div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {[
            { label: 'Daily Report', desc: 'Today\'s revenue breakdown', icon: '📅' },
            { label: 'Weekly Report', desc: 'This week vs last week', icon: '📈' },
            { label: 'Monthly Report', desc: 'Monthly trends & comparison', icon: '📊' },
            { label: 'Custom Range', desc: 'Select date range to analyze', icon: '🔍' },
          ].map(({ label, desc, icon }) => (
            <div key={label} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-4">
              <div className="text-2xl">{icon}</div>
              <div>
                <div className="text-sm font-semibold text-gray-900">{label}</div>
                <div className="text-xs text-gray-400">{desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-blue-50 rounded-2xl p-4">
          <div className="text-xs text-blue-500">Reports module is under development. Real data integration coming soon.</div>
        </div>
      </div>
    </main>
    </PageTransition>
  )
}
