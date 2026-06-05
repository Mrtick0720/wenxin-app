import BackButton from '../components/BackButton'
import PageTransition from '../components/PageTransition'

// Placeholder data — will be replaced with Supabase `complaints` table
const complaints = [
  { id: 1, customer: 'Walk-in Guest', type: 'Food Quality', description: 'Soup was cold when served', severity: 'medium', status: 'open', time: '12:15' },
  { id: 2, customer: 'Bento Order #42', type: 'Delivery', description: 'Order arrived 30 minutes late', severity: 'high', status: 'handling', time: '12:40' },
  { id: 3, customer: 'Table 3 Guest', type: 'Service', description: 'Waited 20 min for menu', severity: 'low', status: 'open', time: '13:10' },
]

const severityConfig: Record<string, { label: string; color: string }> = {
  high: { label: 'Urgent', color: 'bg-red-100 text-red-600' },
  medium: { label: 'Normal', color: 'bg-orange-100 text-orange-600' },
  low: { label: 'Low', color: 'bg-gray-100 text-gray-500' },
}

const statusConfig: Record<string, { label: string; color: string }> = {
  open: { label: 'Open', color: 'text-red-500' },
  handling: { label: 'Handling', color: 'text-orange-500' },
  resolved: { label: 'Resolved', color: 'text-green-500' },
}

export default function ComplaintsPage() {
  const total = complaints.length
  const unresolved = complaints.filter(c => c.status !== 'resolved').length

  return (
    <PageTransition>
    <main className="bg-gray-50 w-full mx-auto">
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <BackButton href="/" />
          <span className="font-semibold text-base">Complaint</span>
        </div>
        <span className="text-xs text-red-400 font-medium">{unresolved} unresolved</span>
      </div>

      <div className="px-4 py-4 pb-8 space-y-4">
        {/* Summary */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="text-sm text-gray-500 mb-3">Today&apos;s Summary</div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{total}</div>
              <div className="text-xs text-gray-400 mt-0.5">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-500">{unresolved}</div>
              <div className="text-xs text-gray-400 mt-0.5">Unresolved</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">{total - unresolved}</div>
              <div className="text-xs text-gray-400 mt-0.5">Resolved</div>
            </div>
          </div>
        </div>

        {/* Complaint List */}
        <div>
          <div className="text-sm font-semibold text-gray-700 mb-2">Today&apos;s Complaints</div>
          <div className="space-y-3">
            {complaints.length === 0 && (
              <div className="text-center text-gray-400 py-8">No complaints today</div>
            )}
            {complaints.map((c) => {
              const severity = severityConfig[c.severity] || severityConfig.low
              const status = statusConfig[c.status] || statusConfig.open
              return (
                <div key={c.id} className="bg-white rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{c.type}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${severity.color}`}>
                        {severity.label}
                      </span>
                    </div>
                    <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
                  </div>
                  <div className="font-semibold text-gray-900 text-sm mb-1">{c.description}</div>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>{c.customer}</span>
                    <span>{c.time}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-blue-50 rounded-2xl p-4">
          <div className="text-xs text-blue-500">Complaint data is currently using sample data. Real data will appear after Supabase integration.</div>
        </div>
      </div>
    </main>
    </PageTransition>
  )
}
