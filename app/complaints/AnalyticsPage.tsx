'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useNavigation } from '../components/NavigationStack'
import type { Complaint } from './types'

const periods = ['This Week', 'This Month'] as const
type Period = typeof periods[number]

function filterByPeriod(list: Complaint[], period: Period): Complaint[] {
  const now = new Date()
  if (period === 'This Week') {
    const start = new Date(now)
    start.setDate(start.getDate() - start.getDay())
    start.setHours(0, 0, 0, 0)
    return list.filter(c => new Date(c.date) >= start)
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  return list.filter(c => new Date(c.date) >= start)
}

const categories = ['Food Quality', 'Service', 'Delivery', 'Cleanliness', 'Other'] as const
const severities = ['high', 'medium', 'low'] as const
const severityLabels: Record<string, string> = { high: 'Urgent', medium: 'Normal', low: 'Low' }
const statuses = ['open', 'handling', 'resolved', 'closed'] as const
const statusLabels: Record<string, string> = { open: 'Open', handling: 'Handling', resolved: 'Resolved', closed: 'Closed' }

const allMethods = ['On-site Quality Issue', 'Google Review', 'Foodpanda', 'GrabFood', 'Facebook', 'Online Platform Quality Issue', 'Reported Quality Issue', 'Other']
const methodShort: Record<string, string> = {
  'On-site Quality Issue': 'On-site', 'Google Review': 'Google', 'Foodpanda': 'Foodpanda',
  'GrabFood': 'Grab', 'Facebook': 'Facebook', 'Online Platform Quality Issue': 'Online', 'Reported Quality Issue': 'Reported', 'Other': 'Other',
}

const allResolutions = ['Apology', 'Remake', 'Discount', 'Refund', 'Coupon', 'Training', 'No Action', 'Pending', 'Other']

export default function AnalyticsPage({ complaints }: { complaints: Complaint[] }) {
  const [period, setPeriod] = useState<Period>('This Month')
  const { pop, canPop } = useNavigation()
  const router = useRouter()

  // ── Shared back action (same as the back button) ──
  const closeAnalysis = () => {
    if (canPop) pop()
    else router.push('/complaints')
  }
  const closeRef = useRef(closeAnalysis)
  closeRef.current = closeAnalysis

  // ── Right swipe (finger) = follow-finger drag, then let pop()'s leave animation
  //    continue smoothly from the dragged position (no jump, no fighting animations). ──
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const layer = el.closest('[data-stack-layer]') as HTMLElement | null

    let sx = 0, sy = 0, tracking = false, axis: 'h' | 'v' | null = null, dragging = false

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0]
      if (t.clientX <= 30) return // left-edge zone handled by NavigationStack
      sx = t.clientX; sy = t.clientY; tracking = true; axis = null; dragging = false
    }
    const onMove = (e: TouchEvent) => {
      if (!tracking || !layer) return
      const dx = e.touches[0].clientX - sx
      const dy = e.touches[0].clientY - sy
      if (!axis && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
        axis = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
      }
      if (axis !== 'h' || dx <= 0) return // only rightward horizontal drags
      e.preventDefault()
      if (!dragging) {
        dragging = true
        layer.getAnimations().forEach(a => a.cancel()) // clear enter-animation fill so inline transform applies
      }
      layer.style.transform = `translateX(${dx}px)` // follow finger, no transition during drag
    }
    const onEnd = (e: TouchEvent) => {
      if (!tracking) return
      tracking = false
      if (!layer || axis !== 'h') return
      const dx = e.changedTouches[0].clientX - sx
      if (dx > window.innerWidth * 0.35) {
        // past threshold → DON'T reset transform; pop()'s leave animation reads the current
        // transform and slides out to the right from exactly here.
        closeRef.current()
      } else if (dragging) {
        // below threshold → spring back to origin from wherever the finger left it
        const m = layer.style.transform.match(/translateX\((-?[\d.]+)px\)/)
        const from = m ? parseFloat(m[1]) : dx
        const a = layer.animate(
          [{ transform: `translateX(${from}px)` }, { transform: 'translateX(0px)' }],
          { duration: 200, easing: 'cubic-bezier(0.3,0,0.1,1)', fill: 'forwards' }
        )
        a.onfinish = () => { layer.style.transform = 'translateX(0px)' }
      }
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
    }
  }, [])

  const active = useMemo(() => filterByPeriod(complaints, period), [complaints, period])
  const archived = useMemo(() => complaints.filter(c => !!c.archivedAt && new Date(c.archivedAt) >= new Date(new Date().getFullYear(), new Date().getMonth(), 1)), [complaints])

  // ── Computations ──
  const byCategory = categories.map(name => ({ name, count: active.filter(c => c.type === name).length }))
  const maxCat = Math.max(1, ...byCategory.map(c => c.count))

  const bySeverity = severities.map(s => ({ name: severityLabels[s], count: active.filter(c => c.severity === s).length }))
  const maxSev = Math.max(1, ...bySeverity.map(s => s.count))

  const byStatus = statuses.map(s => ({ name: statusLabels[s], key: s, count: active.filter(c => c.status === s).length }))

  const byMethod = allMethods
    .map(m => ({ name: methodShort[m] || m, count: active.filter(c => c.complaintMethod === m).length }))
    .filter(m => m.count > 0)

  const byResponsible = (() => {
    const map: Record<string, number> = {}
    active.forEach(c => { const r = c.responsiblePerson || 'Unknown'; map[r] = (map[r] || 0) + 1 })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  })()
  const maxResp = Math.max(1, ...byResponsible.map(([, c]) => c))

  const byResolution = allResolutions
    .map(name => ({ name, count: active.filter(c => c.customerResolution === name).length }))
    .filter(r => r.count > 0)
  const maxRes = Math.max(1, ...byResolution.map(r => r.count))

  const total = active.length

  return (
    <div ref={rootRef} className="bg-gray-50 w-full mx-auto min-h-screen">
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={closeAnalysis} className="flex items-center text-gray-500" aria-label="Back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <span className="font-semibold text-base">Quality Issue Analysis</span>
        </div>
      </div>

      <div className="px-4 py-4 pb-8 space-y-5">
        {/* Period selector */}
        <div className="flex gap-2 items-center">
          {periods.map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`text-xs px-4 py-1.5 rounded-full font-medium transition-colors ${
                period === p ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 border border-gray-200'
              }`}>
              {p}
            </button>
          ))}
          <span className="text-xs text-gray-400 ml-auto">{total} quality issues</span>
        </div>

        {/* Total Summary */}
        <Section title="Quality Issue Summary">
          <div className="grid grid-cols-5 gap-2">
            {[{ label: 'Total', count: total, color: 'text-gray-900' },
              { label: 'Open', count: active.filter(c => c.status === 'open').length, color: 'text-red-500' },
              { label: 'Handling', count: active.filter(c => c.status === 'handling').length, color: 'text-orange-500' },
              { label: 'Resolved', count: active.filter(c => c.status === 'resolved').length, color: 'text-green-500' },
              { label: 'Closed', count: active.filter(c => c.status === 'closed').length, color: 'text-gray-400' },
            ].map(s => (
              <div key={s.label} className="bg-gray-50 rounded-xl p-2 text-center">
                <div className={`text-lg font-bold ${s.color}`}>{s.count}</div>
                <div className="text-[10px] text-gray-500">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-gray-400 mt-2">Archived: {archived.length} records</div>
        </Section>

        {/* Category */}
        <Section title="By Category">
          {byCategory.map(c => (
            <Bar key={c.name} label={c.name} count={c.count} max={maxCat} color="bg-orange-400" />
          ))}
        </Section>

        {/* Severity */}
        <Section title="By Severity">
          {bySeverity.map(s => (
            <Bar key={s.name} label={s.name} count={s.count} max={maxSev} color="bg-red-400" />
          ))}
        </Section>

        {/* Status */}
        <Section title="By Status">
          <div className="flex gap-2">
            {byStatus.map(s => (
              <div key={s.key} className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-gray-900">{s.count}</div>
                <div className="text-[10px] text-gray-500">{s.name}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Responsible Person */}
        <Section title="By Responsible Person">
          {byResponsible.length === 0 && <div className="text-xs text-gray-400 py-2">No data</div>}
          {byResponsible.map(([name, count]) => (
            <Bar key={name} label={name} count={count} max={maxResp} color="bg-blue-400" />
          ))}
        </Section>

        {/* Method / Platform */}
        <Section title="By Platform">
          <div className="flex flex-wrap gap-2">
            {byMethod.map(m => (
              <span key={m.name} className="text-xs bg-gray-100 rounded-full px-3 py-1">
                {m.name} <span className="font-medium text-gray-700">{m.count}</span>
              </span>
            ))}
          </div>
        </Section>

        {/* Resolution */}
        <Section title="By Resolution">
          {byResolution.length === 0 && <div className="text-xs text-gray-400 py-2">No data</div>}
          {byResolution.map(r => (
            <Bar key={r.name} label={r.name} count={r.count} max={maxRes} color="bg-green-400" />
          ))}
        </Section>

        <div className="h-4" />
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="text-sm font-semibold text-gray-800 mb-3">{title}</div>
      {children}
    </div>
  )
}

function Bar({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-2 mb-2 last:mb-0">
      <span className="text-xs text-gray-600 w-24 flex-shrink-0 truncate">{label}</span>
      <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${(count / max) * 100}%`, minWidth: count > 0 ? 8 : 0 }} />
      </div>
      <span className="text-xs font-medium text-gray-700 w-8 text-right">{count}</span>
    </div>
  )
}
