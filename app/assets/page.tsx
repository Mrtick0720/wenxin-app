'use client'

import BackButton from '../components/BackButton'
import PageTransition from '../components/PageTransition'

export default function AssetsPage() {
  return (
    <PageTransition>
      <main className="bg-gray-50 w-full mx-auto min-h-screen">
        <div className="bg-white px-4 py-3 flex items-center gap-3 border-b sticky top-0 z-10">
          <BackButton href="/" />
          <span className="font-semibold text-base">Assets</span>
        </div>
        <div className="px-4 py-6">
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="text-sm font-semibold text-gray-800 mb-1">Coming soon</div>
            <p className="text-xs text-gray-500 mb-3">Equipment &amp; asset management. Planned features:</p>
            <ul className="text-xs text-gray-600 space-y-1 list-disc pl-4">
              <li>Equipment register (POS, printer, freezer, aircond, kitchen equipment)</li>
              <li>Asset status</li>
              <li>Warranty information</li>
            </ul>
            <p className="text-[11px] text-gray-400 mt-3">Maintenance cases are handled via Incidents (Incident Type = Asset / Maintenance).</p>
          </div>
        </div>
      </main>
    </PageTransition>
  )
}
