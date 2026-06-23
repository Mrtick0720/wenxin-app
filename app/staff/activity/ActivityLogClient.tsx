'use client'

import { useMemo, useState } from 'react'
import { DatePickerField } from '@/app/components/DateTimePickerFields'

export type AuditRow = {
  id: number
  actor_staff_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  summary: string
  before_data: unknown
  after_data: unknown
  created_at: string
}

export type SessionRow = {
  id: string
  staff_id: string
  started_at: string
  last_seen_at: string
  expires_at: string
  ended_at: string | null
  end_reason: string | null
  device_summary: string
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-MY', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kuching',
  }).format(new Date(value))
}

function formatDuration(start: string, end: string) {
  const milliseconds = Math.max(0, new Date(end).getTime() - new Date(start).getTime())
  const totalMinutes = Math.round(milliseconds / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}

function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2)
}

export default function ActivityLogClient({
  audits,
  sessions,
}: {
  audits: AuditRow[]
  sessions: SessionRow[]
}) {
  const [staffId, setStaffId] = useState('all')
  const [date, setDate] = useState('')
  const [action, setAction] = useState('all')
  const [area, setArea] = useState('all')

  const staffOptions = useMemo(() => {
    const values = new Set<string>()
    audits.forEach(row => row.actor_staff_id && values.add(row.actor_staff_id))
    sessions.forEach(row => values.add(row.staff_id))
    return [...values].sort()
  }, [audits, sessions])

  const actionOptions = useMemo(
    () => [...new Set(audits.map(row => row.action))].sort(),
    [audits]
  )
  const areaOptions = useMemo(
    () => [...new Set(audits.map(row => row.entity_type))].sort(),
    [audits]
  )

  const filteredAudits = audits.filter(row =>
    (staffId === 'all' || row.actor_staff_id === staffId) &&
    (!date || row.created_at.slice(0, 10) === date) &&
    (action === 'all' || row.action === action) &&
    (area === 'all' || row.entity_type === area)
  )

  const filteredSessions = sessions.filter(row =>
    (staffId === 'all' || row.staff_id === staffId) &&
    (!date || row.started_at.slice(0, 10) === date)
  )

  return (
    <>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <select value={staffId} onChange={event => setStaffId(event.target.value)} className="h-10 rounded-lg border border-gray-200 bg-white px-2 text-xs">
          <option value="all">All staff</option>
          {staffOptions.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
        <DatePickerField ariaLabel="Filter by date" value={date} onChange={setDate} placeholder="All dates" />
        <select value={action} onChange={event => setAction(event.target.value)} className="h-10 rounded-lg border border-gray-200 bg-white px-2 text-xs">
          <option value="all">All actions</option>
          {actionOptions.map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
        </select>
        <select value={area} onChange={event => setArea(event.target.value)} className="h-10 rounded-lg border border-gray-200 bg-white px-2 text-xs">
          <option value="all">All areas</option>
          {areaOptions.map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
        </select>
      </div>

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">Login sessions</h2>
          <span className="text-xs text-gray-400">{filteredSessions.length}</span>
        </div>
        <div className="mt-2 overflow-hidden rounded-lg border border-gray-100 bg-white">
          {filteredSessions.length === 0 && <p className="px-4 py-6 text-center text-sm text-gray-400">No sessions found</p>}
          {filteredSessions.map(session => {
            const end = session.ended_at ?? session.last_seen_at
            const status = session.ended_at ? session.end_reason ?? 'ended' : 'active'
            return (
              <div key={session.id} className="border-b border-gray-100 px-4 py-3 last:border-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{session.staff_id}</div>
                    <div className="mt-0.5 text-xs text-gray-400">{formatDateTime(session.started_at)}</div>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${status === 'active' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                    {status}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                  <span>Duration: {formatDuration(session.started_at, end)}</span>
                  <span>Last activity: {formatDateTime(session.last_seen_at)}</span>
                </div>
                {session.device_summary && <p className="mt-1 truncate text-[11px] text-gray-400">{session.device_summary}</p>}
              </div>
            )
          })}
        </div>
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">Operations</h2>
          <span className="text-xs text-gray-400">{filteredAudits.length}</span>
        </div>
        <div className="mt-2 space-y-2">
          {filteredAudits.length === 0 && <p className="rounded-lg bg-white px-4 py-6 text-center text-sm text-gray-400">No activity found</p>}
          {filteredAudits.map(row => (
            <article key={row.id} className="rounded-lg border border-gray-100 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900">{row.actor_staff_id ?? 'System'}</div>
                  <p className="mt-1 text-sm text-gray-600">{row.summary}</p>
                </div>
                <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-600">
                  {row.action.replaceAll('_', ' ')}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 text-xs text-gray-400">
                <span>{formatDateTime(row.created_at)}</span>
                <span>{row.entity_type.replaceAll('_', ' ')}</span>
                {row.entity_id && <span>#{row.entity_id}</span>}
              </div>
              {(row.before_data != null || row.after_data != null) && (
                <details className="mt-3 border-t border-gray-100 pt-2">
                  <summary className="cursor-pointer text-xs font-medium text-gray-500">View changes</summary>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    {row.before_data != null && (
                      <div>
                        <div className="mb-1 text-[11px] font-medium text-gray-400">Before</div>
                        <pre className="max-h-60 overflow-auto rounded-md bg-gray-50 p-2 text-[11px] text-gray-600">{prettyJson(row.before_data)}</pre>
                      </div>
                    )}
                    {row.after_data != null && (
                      <div>
                        <div className="mb-1 text-[11px] font-medium text-gray-400">After</div>
                        <pre className="max-h-60 overflow-auto rounded-md bg-gray-50 p-2 text-[11px] text-gray-600">{prettyJson(row.after_data)}</pre>
                      </div>
                    )}
                  </div>
                </details>
              )}
            </article>
          ))}
        </div>
      </section>
    </>
  )
}
