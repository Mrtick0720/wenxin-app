'use client'

import { useState } from 'react'
import { useGlobalToast } from '@/app/components/GlobalToast'
import { setFixedOffDayAction } from './schedule-actions'

// value = Postgres dow (0=Sun … 6=Sat); null = no fixed off day.
const OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'None' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
]

type Props = {
  staffId: string
  current: number | null
  editable: boolean
}

export default function FixedOffDayEditor({ staffId, current, editable }: Props) {
  const { showToast } = useGlobalToast()
  const [selected, setSelected] = useState<number | null>(current)
  const [saving, setSaving] = useState(false)

  async function choose(value: number | null) {
    if (!editable || saving || value === selected) return
    const prev = selected
    setSelected(value)
    setSaving(true)
    const res = await setFixedOffDayAction(staffId, value)
    setSaving(false)
    if (res.ok) {
      showToast('Fixed off day updated')
    } else {
      setSelected(prev)
      showToast(res.error, 'error')
    }
  }

  if (!editable) {
    const label = OPTIONS.find((o) => o.value === selected)?.label ?? 'None'
    return <span className="text-base font-medium text-gray-800">{selected === null ? '—' : label}</span>
  }

  return (
    <div className="grid grid-cols-4 gap-2">
      {OPTIONS.map((opt) => {
        const active = opt.value === selected
        return (
          <button
            key={String(opt.value)}
            type="button"
            disabled={saving}
            onClick={() => choose(opt.value)}
            className={`py-2 rounded-xl text-sm font-semibold border transition-colors ${
              active
                ? 'border-orange-400 bg-orange-50 text-orange-600'
                : 'border-gray-200 bg-white text-gray-600 active:bg-gray-50'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
