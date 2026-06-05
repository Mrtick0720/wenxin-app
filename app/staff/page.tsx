import Link from 'next/link'
import PageTransition from '../components/PageTransition'

const staff = [
  { id: 1, name: 'Ah Ming', role: 'Chef', status: 'on-duty', shift: '10:00 - 20:00', phone: '012-3456789' },
  { id: 2, name: 'Siti', role: 'Server', status: 'on-duty', shift: '11:00 - 21:00', phone: '016-7890123' },
  { id: 3, name: 'Raj', role: 'Kitchen Helper', status: 'on-duty', shift: '09:00 - 19:00', phone: '019-8765432' },
  { id: 4, name: 'Mei Ling', role: 'Server', status: 'off', shift: '—', phone: '013-4567890' },
  { id: 5, name: 'Ahmad', role: 'Dishwasher', status: 'leave', shift: '—', phone: '017-2345678' },
]

const statusConfig: Record<string, { label: string; color: string }> = {
  'on-duty': { label: 'On Duty', color: 'text-green-500' },
  'off': { label: 'Off', color: 'text-gray-400' },
  'leave': { label: 'On Leave', color: 'text-orange-500' },
}

export default function StaffPage() {
  const onDuty = staff.filter(s => s.status === 'on-duty').length

  return (
    <PageTransition>
    <main className="min-h-screen bg-gray-50 w-full mx-auto">
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-gray-500 text-xl">←</Link>
          <span className="font-semibold text-base">Staff</span>
        </div>
        <span className="text-xs text-green-500 font-medium">{onDuty} on duty</span>
      </div>

      <div className="px-4 py-4 pb-8 space-y-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="text-sm text-gray-500 mb-3">Today&apos;s Shift</div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{staff.length}</div>
              <div className="text-xs text-gray-400 mt-0.5">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">{onDuty}</div>
              <div className="text-xs text-gray-400 mt-0.5">On Duty</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-500">{staff.filter(s => s.status === 'leave').length}</div>
              <div className="text-xs text-gray-400 mt-0.5">On Leave</div>
            </div>
          </div>
        </div>

        <div>
          <div className="text-sm font-semibold text-gray-700 mb-2">Team</div>
          <div className="space-y-2">
            {staff.map((s) => {
              const status = statusConfig[s.status] || statusConfig['off']
              return (
                <div key={s.id} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-semibold text-sm flex-shrink-0">
                    {s.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm font-semibold text-gray-900">{s.name}</span>
                      <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>{s.role}</span>
                      <span>{s.shift}</span>
                      <span>{s.phone}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-blue-50 rounded-2xl p-4">
          <div className="text-xs text-blue-500">Staff data is currently using sample data. Real data will appear after Supabase integration.</div>
        </div>
      </div>
    </main>
    </PageTransition>
  )
}
