'use client'

import { useCallback, useEffect, useState } from 'react'
import BackButton from '@/app/components/BackButton'
import { useStaff } from '@/app/components/StaffProvider'
import { useGlobalToast } from '@/app/components/GlobalToast'
import { todayLocalStr } from '@/lib/dateUtils'
import type { PublicHoliday } from '@/lib/schedule/types'
import { addHolidayAction, fetchHolidaysAction, removeHolidayAction } from '../schedule-actions'

export default function HolidaysManager() {
  const staff = useStaff()
  const { showToast } = useGlobalToast()
  const canManage = staff?.role === 'owner' || staff?.role === 'manager'

  const year = todayLocalStr().slice(0, 4)
  const [holidays, setHolidays] = useState<PublicHoliday[]>([])
  const [loading, setLoading] = useState(true)
  const [newDate, setNewDate] = useState(`${year}-01-01`)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const res = await fetchHolidaysAction(`${year}-01-01`, `${year}-12-31`)
    if (res.ok) setHolidays(res.data)
    setLoading(false)
  }, [year])

  useEffect(() => {
    let active = true
    fetchHolidaysAction(`${year}-01-01`, `${year}-12-31`).then((res) => {
      if (!active) return
      if (res.ok) setHolidays(res.data)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [year])

  async function handleAdd() {
    if (!newName.trim()) {
      showToast('Enter a holiday name', 'error')
      return
    }
    setSaving(true)
    const res = await addHolidayAction(newDate, newName)
    setSaving(false)
    if (res.ok) {
      showToast('Holiday added')
      setNewName('')
      load()
    } else {
      showToast(res.error, 'error')
    }
  }

  async function handleRemove(id: number, name: string) {
    if (!window.confirm(`Remove "${name}"?`)) return
    const res = await removeHolidayAction(id)
    if (res.ok) {
      showToast('Holiday removed')
      load()
    } else {
      showToast(res.error, 'error')
    }
  }

  return (
    <main className="h-full flex flex-col bg-gray-50">
      <header className="flex-shrink-0 flex items-center gap-3 border-b bg-white px-4 py-3">
        <BackButton href="/staff" />
        <h1 className="text-base font-semibold text-gray-900">Public Holidays {year}</h1>
      </header>

      <div
        className="flex-1 min-h-0 overflow-y-auto w-full mx-auto max-w-3xl px-4 py-4 space-y-4"
        style={{ paddingBottom: 'calc(112px + env(safe-area-inset-bottom, 0px))' }}
      >
        {canManage && (
          <section className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">Add holiday</h2>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-orange-400"
                style={{ fontSize: 16 }}
              />
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Holiday name"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-orange-400"
                style={{ fontSize: 16 }}
              />
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={saving}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white active:opacity-90"
              style={{ background: saving ? '#d1d5db' : '#f97316' }}
            >
              {saving ? 'Adding…' : 'Add holiday'}
            </button>
          </section>
        )}

        <section className="space-y-2">
          {loading ? (
            <div className="text-center text-gray-400 py-8 text-sm">Loading…</div>
          ) : holidays.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm px-4 py-6 text-center text-sm text-gray-400">
              No holidays for {year}.
            </div>
          ) : (
            holidays.map((h) => (
              <div key={h.id} className="bg-white rounded-2xl shadow-sm px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">{h.name}</div>
                  <div className="text-xs text-gray-400">{h.date}</div>
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => handleRemove(h.id, h.name)}
                    className="text-xs font-medium text-red-500 active:opacity-70 flex-shrink-0"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))
          )}
        </section>
      </div>
    </main>
  )
}
