import Link from 'next/link'
import PageTransition from '../components/PageTransition'

// Placeholder data — will be replaced with Supabase `reservations` table
const reservations = [
  { id: 1, name: 'Alex Tan', phone: '012-3456789', pax: 4, time: '12:00', date: '2026-06-05', note: 'Window seat preferred', status: 'confirmed' },
  { id: 2, name: 'Sarah Lee', phone: '016-7890123', pax: 2, time: '12:30', date: '2026-06-05', note: '', status: 'confirmed' },
  { id: 3, name: 'Mike Wong', phone: '019-8765432', pax: 6, time: '13:00', date: '2026-06-05', note: 'Birthday celebration', status: 'confirmed' },
  { id: 4, name: 'Jenny Lim', phone: '013-4567890', pax: 3, time: '18:30', date: '2026-06-05', note: 'Allergy: shrimp', status: 'pending' },
  { id: 5, name: 'David Chen', phone: '017-2345678', pax: 2, time: '19:00', date: '2026-06-05', note: '', status: 'confirmed' },
  { id: 6, name: 'Family Zhang', phone: '010-9876543', pax: 8, time: '19:30', date: '2026-06-05', note: 'Need baby chair', status: 'confirmed' },
  { id: 7, name: 'Lisa Ng', phone: '014-5678901', pax: 2, time: '20:00', date: '2026-06-05', note: '', status: 'pending' },
  { id: 8, name: 'Robert Khoo', phone: '011-2345678', pax: 4, time: '20:00', date: '2026-06-05', note: 'Vegetarian x1', status: 'confirmed' },
]

const statusConfig: Record<string, { label: string; color: string }> = {
  confirmed: { label: 'Confirmed', color: 'text-green-500' },
  pending: { label: 'Pending', color: 'text-orange-500' },
  cancelled: { label: 'Cancelled', color: 'text-gray-400' },
}

export default function ReservationsPage() {
  const total = reservations.length
  const confirmed = reservations.filter(r => r.status === 'confirmed').length
  const totalPax = reservations.reduce((sum, r) => sum + r.pax, 0)

  return (
    <PageTransition>
    <main className="min-h-screen bg-gray-50 w-full mx-auto">
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-gray-500 text-xl">←</Link>
          <span className="font-semibold text-base">Reservations</span>
        </div>
        <span className="text-xs text-gray-400">{total} bookings</span>
      </div>

      <div className="px-4 py-4 pb-8 space-y-4">
        {/* Summary */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="text-sm text-gray-500 mb-3">Today&apos;s Summary</div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{total}</div>
              <div className="text-xs text-gray-400 mt-0.5">Bookings</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">{confirmed}</div>
              <div className="text-xs text-gray-400 mt-0.5">Confirmed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-500">{totalPax}</div>
              <div className="text-xs text-gray-400 mt-0.5">Total Pax</div>
            </div>
          </div>
        </div>

        {/* Reservation List */}
        <div>
          <div className="text-sm font-semibold text-gray-700 mb-2">Today&apos;s Reservations</div>
          <div className="space-y-3">
            {reservations.map((r) => {
              const status = statusConfig[r.status] || statusConfig.pending
              return (
                <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{r.name}</span>
                      <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
                    </div>
                    <span className="text-sm font-semibold text-orange-500">{r.time}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>👥 {r.pax} pax</span>
                    <span>📞 {r.phone}</span>
                  </div>
                  {r.note && (
                    <div className="mt-2 text-xs text-orange-500 bg-orange-50 rounded-lg px-3 py-1.5">
                      📝 {r.note}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-blue-50 rounded-2xl p-4">
          <div className="text-xs text-blue-500">Reservation data is currently using sample data. Real data will appear after Supabase integration.</div>
        </div>
      </div>
    </main>
    </PageTransition>
  )
}
