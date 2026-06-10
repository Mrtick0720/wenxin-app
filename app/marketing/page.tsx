'use client'

import BackButton from '../components/BackButton'
import PageTransition from '../components/PageTransition'

// Placeholder Marketing hub. This is the destination for the new bottom-nav
// "Marketing" tab; individual tools (campaigns, promotions, loyalty, channels)
// will be built out in follow-up work. Layout mirrors other primary module
// pages: PageTransition + BackButton header + its own BottomNav so the tab bar
// stays visible, with pb-28 so content is never hidden behind the nav.

const modules = [
  { key: 'campaigns', label: 'Campaigns', desc: 'Plan and track promotions', icon: 'M3 11l18-5v12L3 14v-3z M11.6 16.8a3 3 0 1 1-5.8-1.6' },
  { key: 'promotions', label: 'Promotions', desc: 'Discounts & set meals', icon: 'M20 12V8H6a2 2 0 0 1 0-4h14v4 M4 6v12a2 2 0 0 0 2 2h14v-4 M18 12a2 2 0 0 0 0 4h4v-4z' },
  { key: 'loyalty', label: 'Loyalty', desc: 'Members & rewards', icon: 'M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z' },
  { key: 'channels', label: 'Channels', desc: 'Social & messaging', icon: 'M4 4h16v12H5.2L4 17.2V4z' },
]

export default function MarketingPage() {
  return (
    <PageTransition>
    <main className="bg-gray-50 w-full mx-auto min-h-screen">
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <BackButton href="/" />
          <span className="font-semibold text-base">Marketing</span>
        </div>
        <span className="text-xs text-gray-400">Coming soon</span>
      </div>

      <div className="px-4 py-4 pb-28 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {modules.map((m) => (
            <div key={m.key} className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="w-9 h-9 rounded-full bg-orange-50 flex items-center justify-center mb-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d={m.icon} />
                </svg>
              </div>
              <div className="text-sm font-semibold text-gray-900">{m.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">{m.desc}</div>
            </div>
          ))}
        </div>

        <div className="bg-blue-50 rounded-2xl p-4">
          <div className="text-xs text-blue-500">Marketing tools are not built yet. This hub is a placeholder so the navigation tab is in place — campaigns, promotions, loyalty and channels will be added in follow-up work.</div>
        </div>
      </div>
    </main>
    </PageTransition>
  )
}
