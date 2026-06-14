'use client'

import { useState, useRef, lazy, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { useNavigation } from './NavigationStack'
import { getPageElement } from '@/app/lib/stackPages'
import { useHideAmounts } from '@/app/hooks/useHideAmounts'
import { useRevenueRefresh } from '@/app/hooks/useRevenueRefresh'
import { formatAmount } from '@/app/lib/formatAmount'
import { formatGrowthPercent } from '@/app/lib/formatGrowthPercent'
import type { FeedMeDailyRevenue, FeedMeMtdSummary, FeedMe7DaySummary } from '@/lib/feedme/liveDailySales'

const RevenueTodayStack = lazy(() => import('@/app/revenue/RevenueTodayStack'))
const RevenueAnalyticsStack = lazy(() => import('@/app/revenue/RevenueAnalyticsStack'))

interface HeroCardProps {
  revenueTotal: number | null
  revenueYesterday: number | null
  growthPercent: number | null
  mtdRevenue: number | null
  mtdAverage: number | null
  bestDayRevenue: number | null
  revenueBento: number
  bentoOrders: number
  bentoCompleted: number
  bentoPercent: number
  feedMeRevenue: FeedMeDailyRevenue | null
  feedMeMtd: FeedMeMtdSummary | null
  feedMe7Day: FeedMe7DaySummary | null
}

const SLIDE_COUNT = 3
const ELASTIC = 0.35

export default function HeroCard({
  revenueTotal,
  revenueYesterday,
  growthPercent,
  mtdRevenue,
  mtdAverage,
  bestDayRevenue,
  revenueBento,
  bentoOrders,
  bentoCompleted,
  bentoPercent,
  feedMeRevenue,
  feedMeMtd,
  feedMe7Day,
}: HeroCardProps) {
  const router = useRouter()
  const { push } = useNavigation()
  const [hidden, toggleHidden] = useHideAmounts()
  const [slide, setSlide] = useState(0)
  const [animating, setAnimating] = useState(false)

  // Auto-refresh revenue data every 60s (slides 1 & 2).
  // When refresh data is available, it takes precedence over initial SSR props.
  // On error, the hook preserves the last successful values — never blanks.
  const refreshed = useRevenueRefresh()

  // Merge: prefer live refresh data when available, fall back to server props.
  const mergedRevenueTotal =
    refreshed.daily?.revenueTotal !== undefined ? refreshed.daily.revenueTotal : revenueTotal
  const mergedRevenueYesterday =
    refreshed.daily?.revenueYesterday !== undefined ? refreshed.daily.revenueYesterday : revenueYesterday
  const mergedGrowthPercent =
    refreshed.daily?.growthPercent !== undefined ? refreshed.daily.growthPercent : growthPercent
  const mergedMtdRevenue =
    refreshed.mtd?.mtdRevenue !== undefined ? refreshed.mtd.mtdRevenue : mtdRevenue
  const mergedMtdAverage =
    refreshed.mtd?.mtdAverage !== undefined ? refreshed.mtd.mtdAverage : mtdAverage
  const mergedBestDayRevenue =
    refreshed.mtd?.bestDayRevenue !== undefined ? refreshed.mtd.bestDayRevenue : bestDayRevenue
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const tracking = useRef(false)
  const touchAxis = useRef<'h' | 'v' | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const containerWidth = useRef(0)

  const animIdRef = useRef(0)

  const goTo = (next: number) => {
    if (animating || next === slide || next < 0 || next >= SLIDE_COUNT) return
    const el = trackRef.current
    if (!el) return
    // Drive the transition entirely via inline style so React's style prop
    // (which writes to the same CSS properties) never causes a flash.
    el.style.transition = 'transform 0.3s cubic-bezier(0.3,0,0.1,1)'
    el.style.transform = `translateX(${-(next * pctPerSlide)}%)`
    setAnimating(true)
    setSlide(next)
    animIdRef.current++
    const id = animIdRef.current
    setTimeout(() => {
      // Only cleanup if no newer animation started
      if (id !== animIdRef.current) return
      // Clear transition only — keep transform so there is no frame where
      // the track reverts to translateX(0) before React's next render.
      el.style.transition = ''
      setAnimating(false)
    }, 320)
  }

  const pctPerSlide = 100 / SLIDE_COUNT

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    tracking.current = true
    touchAxis.current = null
    // Cache width at touch start — avoids forced layout during drag
    containerWidth.current = containerRef.current?.offsetWidth ?? 0
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (!tracking.current || animating) return
    const dx = e.touches[0].clientX - touchStartX.current
    const dy = e.touches[0].clientY - touchStartY.current
    if (!touchAxis.current && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      touchAxis.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
    }
    if (touchAxis.current !== 'h') return
    e.preventDefault()
    const el = trackRef.current
    if (!el) return
    const cw = containerWidth.current
    if (cw <= 0) return
    const basePx = -(slide * cw)
    const maxPx = 0
    const minPx = -((SLIDE_COUNT - 1) * cw)

    // Clamp + elastic: never allow the track to move beyond valid slide bounds
    let offset = basePx + dx
    if (offset > maxPx) {
      // Past first slide (right edge) — rubber-band resistance
      offset = maxPx + (offset - maxPx) * ELASTIC
    } else if (offset < minPx) {
      // Past last slide (left edge) — rubber-band resistance
      offset = minPx + (offset - minPx) * ELASTIC
    }

    el.style.transition = 'none'
    el.style.transform = `translateX(${Math.round(offset)}px)`
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    // ── Tap detection (no directional classification = tap, not a swipe) ──
    if (tracking.current && touchAxis.current === null) {
      tracking.current = false
      if (slide === 0) {
        if (feedMeRevenue) {
          push('/revenue/today', <Suspense fallback={null}><RevenueTodayStack data={feedMeRevenue} /></Suspense>)
        } else {
          router.push('/revenue/today')
        }
      } else if (slide === 1) {
        push('/revenue/analytics', <Suspense fallback={null}><RevenueAnalyticsStack mtd={feedMeMtd} week={feedMe7Day} /></Suspense>)
      } else if (slide === 2) {
        const el = getPageElement('/bento')
        if (el) push('/bento', el)
      }
      return
    }

    if (!tracking.current || touchAxis.current !== 'h') { tracking.current = false; return }
    tracking.current = false
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const threshold = 50
    const el = trackRef.current
    if (!el) return

    if (slide > 0 && dx > threshold) {
      goTo(slide - 1)
    } else if (slide < SLIDE_COUNT - 1 && dx < -threshold) {
      goTo(slide + 1)
    } else {
      // Spring-back: animate entirely via inline style.
      // No React state change — avoids React style prop overwriting inline values.
      el.style.transition = 'transform 0.25s ease-out'
      el.style.transform = `translateX(${-(slide * pctPerSlide)}%)`
      animIdRef.current++
      const id = animIdRef.current
      setTimeout(() => {
        if (id !== animIdRef.current) return
        // Clear transition only — keep transform to avoid translateX(0) flash
        el.style.transition = ''
      }, 260)
    }
  }

  const mtdRevenueLabel =
    mergedMtdRevenue === null ? '—' : `RM ${Math.floor(mergedMtdRevenue).toLocaleString('en-US')}`
  const mtdAverageLabel =
    mergedMtdAverage === null ? '—' : `RM ${Math.floor(mergedMtdAverage).toLocaleString('en-US')}`
  const bestDayLabel =
    mergedBestDayRevenue === null ? '—' : `RM ${Math.floor(mergedBestDayRevenue).toLocaleString('en-US')}`

  // FeedMe-derived: show "—" when yesterday/growth data is unavailable.
  // Uses merged values — live refresh data when available, server props as fallback.
  const revenueLabel = formatAmount(mergedRevenueTotal, hidden)
  // Privacy mode masks the Growth % too (alongside the Today/Yesterday amounts).
  // All numeric formatting goes through formatGrowthPercent so the rendered value
  // is consistent on every browser (never a raw float). Precedence: when hidden
  // and a real value exists → masked; otherwise formatGrowthPercent ("—" for no
  // baseline). Status badge stays computed from the raw mergedGrowthPercent below.
  const growthLabel =
    hidden && mergedGrowthPercent !== null ? '*****' : formatGrowthPercent(mergedGrowthPercent)
  // Status badge is derived from the SAME mergedGrowthPercent as the label, so
  // the two can never disagree. Null = no valid baseline → neutral "No Baseline",
  // never a misleading positive label like "Excellent".
  const revenueStatus =
    mergedGrowthPercent === null ? 'No Baseline'
    : mergedGrowthPercent > 20 ? 'Excellent'
    : mergedGrowthPercent > 10 ? 'Strong'
    : mergedGrowthPercent > 0 ? 'Good'
    : mergedGrowthPercent < 0 ? 'Weak'
    : 'Flat'
  const yesterdayLabel = formatAmount(mergedRevenueYesterday, hidden)

  return (
    <div
      ref={containerRef}
      className="rounded-2xl"
      style={{
        background: 'linear-gradient(150deg, #fb923c 0%, #f97316 45%, #ea580c 100%)',
        touchAction: 'pan-y',
        overflow: 'hidden',
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className="px-0 pt-3 pb-2 overflow-hidden">
        <div
          ref={trackRef}
          className="flex"
          style={{
            width: `${SLIDE_COUNT * 100}%`,
            transform: `translateX(${-(slide * pctPerSlide)}%)`,
            transition: animating ? 'transform 0.3s cubic-bezier(0.3,0,0.1,1)' : 'none',
            willChange: 'transform',
          }}
        >
          {/* ═══ Slide 1: Revenue ═══ */}
          <div
            className="flex-shrink-0 flex flex-col px-5"
            style={{ width: `${pctPerSlide}%` }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-white/90">Today's Revenue</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold tracking-tight text-white leading-none">{revenueLabel}</div>
              <button
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); toggleHidden() }}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
                aria-label={hidden ? 'Show amounts' : 'Hide amounts'}
                className="flex-shrink-0 flex items-center justify-center w-10 h-10 -mr-2 opacity-70 hover:opacity-100 transition-opacity"
              >
                {hidden ? (
                  <EyeOff size={20} stroke="rgba(255,255,255,0.8)" strokeWidth={1.5} />
                ) : (
                  <Eye size={20} stroke="rgba(255,255,255,0.8)" strokeWidth={1.5} />
                )}
              </button>
            </div>
            <div className="flex-1 min-h-0" />
            <div className="flex items-end justify-between">
              <div className="grid grid-cols-[7rem_4rem] gap-2">
                <div>
                  <div className="text-[10px] text-orange-100/70 uppercase tracking-wide">Yesterday</div>
                  <div className="text-base font-bold text-white leading-tight whitespace-nowrap">{yesterdayLabel}</div>
                </div>
                <div>
                  <div className="text-[10px] text-orange-100/70 uppercase tracking-wide">Growth</div>
                  <div className="text-base font-bold text-white leading-tight whitespace-nowrap">{growthLabel}</div>
                </div>
              </div>
              <span className="bg-white/20 text-white text-xs font-medium rounded-full px-3 py-1">{revenueStatus}</span>
            </div>
          </div>

          {/* ═══ Slide 2: Month-to-Date ═══ */}
          <div
            className="flex-shrink-0 flex flex-col px-5"
            style={{ width: `${pctPerSlide}%` }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-white/90">Month-to-Date</div>
            </div>
            <div>
              <div className="text-3xl font-bold tracking-tight text-white leading-none">{mtdRevenueLabel}</div>
            </div>
            <div className="flex-1 min-h-0" />
            <div className="flex items-end justify-between">
              <div className="grid grid-cols-[7rem_4rem] gap-2">
                <div>
                  <div className="text-[10px] text-orange-100/70 uppercase tracking-wide">Avg Daily</div>
                  <div className="text-base font-bold text-white leading-tight whitespace-nowrap">{mtdAverageLabel}</div>
                </div>
                <div>
                  <div className="text-[10px] text-orange-100/70 uppercase tracking-wide">Best Day</div>
                  <div className="text-base font-bold text-white leading-tight whitespace-nowrap">{bestDayLabel}</div>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ Slide 3: Bento ═══ */}
          <div
            className="flex-shrink-0 flex flex-col px-5"
            style={{ width: `${pctPerSlide}%` }}
          >
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <div className="text-sm font-medium text-white/90 mb-2">Bento Revenue</div>
                <div className="text-3xl font-bold text-white leading-none">RM {revenueBento.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-white/70 leading-5 mb-2">Orders</div>
                <div className="text-3xl font-bold text-white leading-none">{bentoOrders}</div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-orange-100/90">Completion Rate</span>
                <span className="text-xs font-semibold text-white">{bentoPercent}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
                <div className="h-full rounded-full bg-white" style={{ width: `${bentoPercent}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Page indicators */}
      <div className="flex items-center justify-center gap-1.5 pb-2.5">
        {Array.from({ length: SLIDE_COUNT }).map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className="rounded-full transition-all"
            style={{
              width: slide === i ? 16 : 5,
              height: 5,
              background: slide === i ? '#ffffff' : 'rgba(255,255,255,0.35)',
            }}
          />
        ))}
      </div>
    </div>
  )
}
