import BackButton from '../components/BackButton'
import PageTransition from '../components/PageTransition'

const tables = [
  { id: 1, number: 'T01', status: 'occupied', pax: 4, opened_at: '11:30', amount: 88.50 },
  { id: 2, number: 'T02', status: 'occupied', pax: 2, opened_at: '12:15', amount: 45.00 },
  { id: 3, number: 'T03', status: 'empty', pax: 0, opened_at: '', amount: 0 },
  { id: 4, number: 'T04', status: 'paid', pax: 3, opened_at: '11:00', amount: 72.00 },
  { id: 5, number: 'T05', status: 'empty', pax: 0, opened_at: '', amount: 0 },
  { id: 6, number: 'T06', status: 'occupied', pax: 6, opened_at: '12:00', amount: 156.00 },
  { id: 7, number: 'T07', status: 'empty', pax: 0, opened_at: '', amount: 0 },
  { id: 8, number: 'T08', status: 'paid', pax: 2, opened_at: '11:45', amount: 38.50 },
]

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  occupied: { label: 'Dining', bg: 'bg-orange-100', text: 'text-orange-600' },
  empty: { label: 'Empty', bg: 'bg-gray-100', text: 'text-gray-400' },
  paid: { label: 'To Clear', bg: 'bg-green-100', text: 'text-green-600' },
}

export default function DineInPage() {
  const occupied = tables.filter(t => t.status === 'occupied').length
  const empty = tables.filter(t => t.status === 'empty').length
  const paid = tables.filter(t => t.status === 'paid').length
  const totalRevenue = tables.reduce((sum, t) => sum + t.amount, 0)

  return (
    <PageTransition>
    <main className="bg-gray-50 w-full mx-auto">
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center gap-3 border-b">
        <BackButton href="/" />
        <span className="font-semibold text-base">Dine-in Details</span>
      </div>

      <div className="px-4 py-4 pb-8 space-y-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-gray-500">Today&apos;s Dine-in Revenue</div>
            <div className="text-xs text-green-500 font-medium">● Open</div>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-3">RM {totalRevenue.toLocaleString()}</div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="text-xl font-bold text-orange-500">{occupied}</div>
              <div className="text-xs text-gray-400 mt-0.5">Dining</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-gray-400">{empty}</div>
              <div className="text-xs text-gray-400 mt-0.5">Empty</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-green-500">{paid}</div>
              <div className="text-xs text-gray-400 mt-0.5">To Clear</div>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-gray-700">Table Status</div>
            <div className="text-xs text-gray-400">{tables.length} tables</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {tables.map((table) => {
              const config = statusConfig[table.status]
              return (
                <div key={table.id} className={`rounded-2xl p-4 ${config.bg}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-gray-900">{table.number}</span>
                    <span className={`text-xs font-medium ${config.text}`}>{config.label}</span>
                  </div>
                  {table.status !== 'empty' ? (
                    <>
                      <div className="text-sm text-gray-600">{table.pax} pax</div>
                      <div className="text-sm text-gray-400">Opened {table.opened_at}</div>
                      <div className="text-sm font-semibold text-gray-900 mt-1">RM {table.amount}</div>
                    </>
                  ) : (
                    <div className="text-sm text-gray-400">Ready for guests</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-blue-50 rounded-2xl p-4">
          <div className="text-xs text-blue-500">Current table data is simulated. Real table status will appear after POS integration.</div>
        </div>
      </div>
    </main>
    </PageTransition>
  )
}
