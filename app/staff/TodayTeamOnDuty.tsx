'use client'

import { useEffect, useState } from 'react'
import { fetchTeamOnDutyAction } from './schedule-actions'

type Member = { staffId: string; name: string; role: string }

export default function TodayTeamOnDuty({ date }: { date: string }) {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetchTeamOnDutyAction(date).then((res) => {
      if (!active) return
      if (res.ok) setMembers(res.data)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [date])

  if (loading) {
    return <div className="text-center text-gray-400 py-6 text-sm">Loading team…</div>
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
