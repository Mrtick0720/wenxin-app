'use client'

import { useEffect, useState } from 'react'
import { fetchTeamOnDutyAction } from './schedule-actions'

type Member = { staffId: string; name: string; role: string }

export default function TodayTeamOnDuty({ date }: { date: string }) {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetchTeamOnDutyAction(date)
      .then((res) => {
        if (!active) return
        if (res.ok) {
          setMembers(res.data)
          setError(null)
        } else {
          setError(res.error)
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [date])

  if (loading) {
    return <div className="text-center text-gray-400 py-6 text-sm">Loading team…</div>
  }
  if (error) {
    return (
      <div className="bg-white rounded-2xl shadow-sm px-4 py-5 text-center">
        <div className="text-sm font-medium text-red-500">Couldn&apos;t load the team</div>
        <div className="text-xs text-gray-400 mt-1 break-words">{error}</div>
      </div>
    )
  }
  if (members.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm px-4 py-6 text-center text-sm text-gray-400">
        No one scheduled to work.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {members.map((m) => (
        <div key={m.staffId} className="bg-white rounded-2xl shadow-sm px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-900">{m.name}</span>
          <span className="text-xs text-gray-400">{m.role}</span>
        </div>
      ))}
    </div>
  )
}
