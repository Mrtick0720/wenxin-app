'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useNavigation } from './NavigationStack'
import { getPageElement } from '@/app/lib/stackPages'

interface HeroCardProps {
  revenueTotal: number
  revenueDineIn: number
  revenueBento: number
  bentoOrders: number
  bentoCompleted: number
  bentoPercent: number
}

const SLIDE_COUNT = 3
const ELASTIC = 0.35

export default function HeroCard({
  revenueTotal,
  revenueDineIn,
  revenueBento,
  bentoOrders,
  bentoCompleted,
  bentoPercent,
}: HeroCardProps) {
  const router = useRouter()
  const { push } = useNavigation()
  const [slide, setSlide] = useState(0)
  const [animating, setAnimating] = useState(false)
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
      if (slide === 1) {
        const el = getPageElement('/dine-in')
        if (el) push('/dine-in', el)
      } else if (slide === 2) {
        const el = getPageElement('/bento')
        if (el) push('/bento', el)
      }
      // Slide 0: existing reports button handles its own navigation
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

  const dineInAvg = revenueDineIn > 0 ? Math.round(revenueDineIn / 42) : 0

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
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-white/90">Today&apos;s Revenue</div>
              <button
                onClick={() => router.push('/reports')}
                className="opacity-70 hover:opacity-100 transition-opacity"
                aria-label="Reports"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4 16 10 10 15 13 20 5" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <div className="text-3xl font-bold tracking-tight text-white leading-none">RM {revenueTotal.toLocaleString()}</div>
                <div className="text-xs text-orange-100/80 mt-1.5">Revenue</div>
              </div>
              <div>
                <div className="text-3xl font-bold tracking-tight text-white leading-none">+12%</div>
                <div className="text-xs text-orange-100/80 mt-1.5">Growth</div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xs text-orange-100/90">vs Yesterday <span className="text-white/90 font-medium">RM 7,614</span></div>
              <span className="bg-white/20 text-white text-xs font-medium rounded-full px-3 py-1">Excellent</span>
            </div>
          </div>

          {/* ═══ Slide 2: Dine-in ═══ */}
          <div
            className="flex-shrink-0 flex flex-col px-5"
            style={{ width: `${pctPerSlide}%` }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-white/90">Dine-in</div>
              <span className="text-xs text-white/70">Active</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <div className="text-3xl font-bold text-white leading-none">RM {revenueDineIn.toLocaleString()}</div>
                <div className="text-xs text-orange-100/80 mt-1.5">Revenue</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white leading-none">42</div>
                <div className="text-xs text-orange-100/80 mt-1.5">Orders</div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xs text-orange-100/90">Avg Ticket <span className="text-white/90 font-medium">RM {dineInAvg}</span></div>
              <span className="bg-white/20 text-white text-xs font-medium rounded-full px-3 py-1">On Track</span>
            </div>
          </div>

          {/* ═══ Slide 3: Bento ═══ */}
          <div
            className="flex-shrink-0 flex flex-col px-5"
            style={{ width: `${pctPerSlide}%` }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-white/90">Bento</div>
              <span className="text-xs text-white/70">Prepping</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <div className="text-3xl font-bold text-white leading-none">RM {revenueBento.toLocaleString()}</div>
                <div className="text-xs text-orange-100/80 mt-1.5">Revenue</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white leading-none">{bentoOrders}</div>
                <div className="text-xs text-orange-100/80 mt-1.5">Orders</div>
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
