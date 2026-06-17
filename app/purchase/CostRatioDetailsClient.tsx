'use client'

import type { PurchaseKpi, RatioPeriod } from '@/lib/purchaseLedger/types'
import { statusLabel } from '@/lib/purchaseLedger/kpiMath'
import BackButton from '../components/BackButton'

function heroStatus(ratio: number | null): 'good' | 'warning' | 'bad' | 'na' {
  if (ratio === null) return 'na'
  if (ratio <= 30) return 'good'
  if (ratio <= 40) return 'warning'
  return 'bad'
}

const STATUS_COLOR = {
  good:    { text: '#16a34a', bg: '#f0fdf4', bar: '#4ade80' },
  warning: { text: '#d97706', bg: '#fffbeb', bar: '#fbbf24' },
  bad:     { text: '#dc2626', bg: '#fef2f2', bar: '#f87171' },
  na:      { text: '#9ca3af', bg: '#f9fafb', bar: '#d1d5db' },
}

function rm(n: number | null | undefined) {
  if (n === null || n === undefined) return '—'
  return `RM ${n.toFixed(2)}`
}

function ratioText(r: number | null) {
  return r === null ? '—' : `${r % 1 === 0 ? r.toFixed(0) : r.toFixed(1)}%`
}

const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December']

// Target = 30%, bar scale max = 60% → target sits at 50% bar width
const BAR_SCALE_MAX = 60
const TARGET_PCT = (30 / BAR_SCALE_MAX) * 100

function PeriodRow({ label, p, showAmounts }: { label: string; p: RatioPeriod; showAmounts: boolean }) {
  const st = heroStatus(p.ratio)
  const c = STATUS_COLOR[st]
  const barPct = p.ratio !== null ? Math.min((p.ratio / BAR_SCALE_MAX) * 100, 100) : 0

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-700">{label}</span>
        <div className="flex items-center gap-2">
          <span className="font-bold text-lg" style={{ color: c.text }}>{ratioText(p.ratio)}</span>
          <span
            className="text-[11px] font-medium px-2 py-0.5 rounded-full"
            style={{ background: c.bg, color: c.text }}
          >
            {statusLabel(st)}
          </span>
        </div>
      </div>
      {/* Ratio bar — target line at 50% */}
      <div className="relative h-2 rounded-full mb-3" style={{ background: '#f3f4f6' }}>
        {p.ratio !== null && (
          <div
            className="absolute left-0 top-0 h-full rounded-full"
            style={{ width: `${barPct}%`, background: c.bar }}
          />
        )}
        <div
          className="absolute top-0 h-full w-0.5"
          style={{ left: `${TARGET_PCT}%`, background: '#9ca3af' }}
        />
      </div>
      {showAmounts && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[11px] text-gray-400 mb-0.5">Purchase</div>
            <div className="text-sm font-semibold text-gray-900">{rm(p.purchase)}</div>
          </div>
          <div>
            <div className="text-[11px] text-gray-400 mb-0.5">Revenue</div>
            <div className="text-sm font-semibold text-gray-900">{rm(p.revenue)}</div>
          </div>
        </div>
      )}
    </div>
  )
}

type Props = { kpi: PurchaseKpi; today: string }

export default function CostRatioDetailsClient({ kpi, today }: Props) {
  const d = new Date(today + 'T00:00:00')
  const monthLabel = `${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`

  const periods: { label: string; p: RatioPeriod }[] = [
    { label: 'Today', p: kpi.today },
    ...(kpi.week  ? [{ label: 'This Week',                   p: kpi.week  }] : []),
    ...(kpi.month ? [{ label: `This Month · ${monthLabel}`,  p: kpi.month }] : []),
  ]

  return (
    <div
      className="page-slide-in"
      style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#f9fafb' }}
    >
      <div className="bg-white px-4 py-3 flex items-center gap-3 border-b" style={{ flexShrink: 0 }}>
        <BackButton href="/purchase" />
        <span className="font-semibold text-base">Cost Ratio Details</span>
      </div>

      <div
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}
      >
        <div className="px-4 pt-4 space-y-3">
          {/* Legend */}
          <div className="flex items-center justify-end gap-4 px-1">
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
              <div className="w-2 h-2 rounded-full bg-green-400" />≤30%
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
              <div className="w-2 h-2 rounded-full bg-yellow-400" />30–40%
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
              <div className="w-2 h-2 rounded-full bg-red-400" />&gt;40%
            </div>
          </div>

          {periods.map((x) => (
            <PeriodRow key={x.label} label={x.label} p={x.p} showAmounts={kpi.showAmounts} />
          ))}

          {!kpi.showAmounts && (
            <p className="text-center text-[11px] text-gray-400 pt-1">
              Purchase and revenue amounts visible to owners and managers only.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
