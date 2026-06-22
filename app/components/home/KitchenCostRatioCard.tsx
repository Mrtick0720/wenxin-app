'use client'

// Kitchen cost-ratio hero — tappable. Shows today's ratio (no amounts); tapping
// opens the shared Cost Ratio Details (Today / This Week / This Month), which
// gates amounts by role so the kitchen sees ratio-only.

import { useNavigation } from '../NavigationStack'
import CostRatioDetailsClient from '../../purchase/CostRatioDetailsClient'
import type { PurchaseKpi } from '@/lib/purchaseLedger/types'
import type { RatioStatus } from '@/lib/purchaseLedger/kpiMath'

const RATIO_THEME: Record<RatioStatus, { gradient: string; fg: string; fgFaint: string; badgeBg: string; badgeFg: string; label: string }> = {
  good:    { gradient: 'linear-gradient(150deg, #22c55e 0%, #16a34a 45%, #15803d 100%)', fg: '#fff', fgFaint: 'rgba(255,255,255,0.72)', badgeBg: 'rgba(255,255,255,0.22)', badgeFg: '#fff', label: 'Good' },
  warning: { gradient: 'linear-gradient(150deg, #fbbf24 0%, #f59e0b 45%, #d97706 100%)', fg: '#422006', fgFaint: 'rgba(66,32,6,0.6)', badgeBg: 'rgba(66,32,6,0.16)', badgeFg: '#422006', label: 'Watch' },
  bad:     { gradient: 'linear-gradient(150deg, #f87171 0%, #ef4444 45%, #dc2626 100%)', fg: '#fff', fgFaint: 'rgba(255,255,255,0.72)', badgeBg: 'rgba(255,255,255,0.22)', badgeFg: '#fff', label: 'Too high' },
  na:      { gradient: 'linear-gradient(150deg, #9ca3af 0%, #6b7280 45%, #4b5563 100%)', fg: '#fff', fgFaint: 'rgba(255,255,255,0.72)', badgeBg: 'rgba(255,255,255,0.22)', badgeFg: '#fff', label: 'No data' },
}

const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function KitchenCostRatioCard({ kpi, today }: { kpi: PurchaseKpi | null; today: string }) {
  const { push } = useNavigation()

  // Today's ratio — same basis the owner sees, fall back to month.
  const ratioPeriod = kpi?.today ?? kpi?.month ?? null
  const status: RatioStatus = ratioPeriod?.status ?? 'na'
  const ratioVal = ratioPeriod?.ratio ?? null
  const theme = RATIO_THEME[status]
  const target = kpi?.target ?? 30
  const d = new Date(today + 'T00:00:00')
  const monthLabel = `${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`

  function openDetails() {
    if (kpi) push('/purchase/kpi-details', <CostRatioDetailsClient kpi={kpi} today={today} />)
  }

  return (
    <button type="button" onClick={openDetails} className="w-full text-left active:opacity-90 rounded-2xl overflow-hidden block" style={{ backgroundImage: theme.gradient }}>
      <div className="px-5 pt-4 pb-4" style={{ color: theme.fg }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium" style={{ color: theme.fgFaint }}>Purchase Cost Ratio</span>
          <span className="flex items-center gap-0.5 text-xs font-medium" style={{ color: theme.fgFaint }}>
            Target ≤ {target}%
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </span>
        </div>
        <div className="flex items-end justify-between">
          <div className="text-4xl font-bold tracking-tight leading-none">
            {ratioVal != null ? `${ratioVal.toFixed(1)}%` : '—'}
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="text-xs font-medium" style={{ color: theme.fgFaint }}>{monthLabel}</span>
            <span className="text-xs font-semibold rounded-full px-3 py-1" style={{ background: theme.badgeBg, color: theme.badgeFg }}>
              {theme.label}
            </span>
          </div>
        </div>
      </div>
    </button>
  )
}
