import { supabase } from '@/lib/supabase'
import { todayLocalStr } from '@/lib/dateUtils'
import BackButton from '../components/BackButton'
import PageTransition from '../components/PageTransition'

async function getIncidents() {
  const today = todayLocalStr()
  const { data } = await supabase
    .from('incidents')
    .select('*')
    .eq('date', today)
    .order('id', { ascending: true })
  return data || []
}

const typeLabel: Record<string, string> = {
  attendance: 'Attendance',
  inventory: 'Inventory',
  equipment: 'Equipment',
  food_safety: 'Food Safety',
  other: 'Other',
}

const severityConfig: Record<string, { label: string; color: string }> = {
  high: { label: 'Urgent', color: 'bg-red-100 text-red-600' },
  medium: { label: 'Attention', color: 'bg-orange-100 text-orange-600' },
  low: { label: 'Normal', color: 'bg-gray-100 text-gray-500' },
}

const statusConfig: Record<string, { label: string; color: string }> = {
  open: { label: 'Open', color: 'text-red-500' },
  handling: { label: 'Handling', color: 'text-orange-500' },
  resolved: { label: 'Resolved', color: 'text-green-500' },
}

export default async function IncidentsPage() {
  const incidents = await getIncidents()
  const open = incidents.filter(i => i.status === 'open').length
  const handling = incidents.filter(i => i.status === 'handling').length
  const resolved = incidents.filter(i => i.status === 'resolved').length

  return (
    <PageTransition>
    <main className="bg-gray-50 w-full mx-auto">
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center gap-3 border-b">
        <BackButton href="/" />
        <span className="font-semibold text-base">Today&apos;s Incidents</span>
      </div>

      <div className="px-4 py-4 pb-8 space-y-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="text-sm text-gray-500 mb-3">Today&apos;s Summary</div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-500">{open}</div>
              <div className="text-xs text-gray-400 mt-0.5">Open</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-500">{handling}</div>
              <div className="text-xs text-gray-400 mt-0.5">Handling</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">{resolved}</div>
              <div className="text-xs text-gray-400 mt-0.5">Resolved</div>
            </div>
          </div>
        </div>

        <div>
          <div className="text-sm font-semibold text-gray-700 mb-2">Incident List</div>
          <div className="space-y-3">
            {incidents.length === 0 && (
              <div className="text-center text-gray-400 py-8">No incidents today</div>
            )}
            {incidents.map((incident) => {
              const severity = severityConfig[incident.severity] || severityConfig.low
              const status = statusConfig[incident.status] || statusConfig.open
              const type = typeLabel[incident.incident_type] || 'Other'
              return (
                <div key={incident.id} className="bg-white rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400">{type}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${severity.color}`}>
                      {severity.label}
                    </span>
                  </div>
                  <div className="font-semibold text-gray-900 mb-2">{incident.title}</div>
                  <div className={`text-xs font-medium ${status.color}`}>{status.label}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </main>
    </PageTransition>
  )
}
