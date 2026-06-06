'use client'

import { useState, useRef } from 'react'

interface HeroCardProps {
  revenueTotal: number
  revenueDineIn: number
  revenueBento: number
  bentoOrders: number
  bentoCompleted: number
  bentoPercent: number
}

export default function HeroCard({
  revenueTotal,
  revenueDineIn,
  revenueBento,
  bentoOrders,
  bentoCompleted,
  bentoPercent,
}: HeroCardProps) {
  const [slide, setSlide] = useState(0)
  const [animating, setAnimating] = useState(false)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const tracking = useRef(false)
  const axis = useRef<'h' | 'v' | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  const goTo = (next: number) => {
    if (animating || next === slide) return
    setAnimating(true)
    setSlide(next)
    setTimeout(() => setAnimating(false), 320)
  }

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    tracking.current = true
    axis.current = null
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (!tracking.current || animating) return
    const dx = e.touches[0].clientX - touchStartX.current
    const dy = e.touches[0].clientY - touchStartY.current
    if (!axis.current && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      axis.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
    }
    if (axis.current !== 'h') return
    e.preventDefault()
    const el = trackRef.current
    if (!el) return
    const offset = slide === 0 ? Math.min(0, dx) : Math.max(-window.innerWidth, dx - window.innerWidth)
    el.style.transition = 'none'
    el.style.transform = `translateX(${offset}px)`
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!tracking.current || axis.current !== 'h') { tracking.current = false; return }
    tracking.current = false
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const threshold = 60
    const el = trackRef.current
    if (!el) return

    if (slide === 0 && dx < -threshold) goTo(1)
    else if (slide === 1 && dx > threshold) goTo(0)
    else {
      // Spring back
      el.style.transition = 'transform 0.28s cubic-bezier(0.3,0,0.1,1)'
      el.style.transform = slide === 0 ? 'translateX(0)' : 'translateX(-100%)'
    }
  }

  const dineInAvg = revenueDineIn > 0 ? Math.round(revenueDineIn / 42) : 0 // 42 orders shown in UI

  return (
    <div
      className="rounded-2xl overflow-hidden relative"
      style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #1a1a2e 100%)', touchAction: 'pan-y' }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className="px-5 pt-5 pb-3 relative overflow-hidden">
        {/* Slides track */}
        <div
          ref={trackRef}
          className="flex"
          style={{
            width: '200%',
            transform: slide === 0 ? 'translateX(0)' : 'translateX(-50%)',
            transition: animating ? 'transform 0.3s cubic-bezier(0.3,0,0.1,1)' : 'none',
          }}
        >
          {/* ── Slide 1: Revenue Today ── */}
          <div className="flex-shrink-0" style={{ width: '50%' }}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-4xl font-bold tracking-tight text-white">RM {revenueTotal.toLocaleString()}</div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs text-slate-400">Today&apos;s Revenue</span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs">
                  <span className="text-green-400 font-medium">+12%</span>
                  <span className="text-slate-500">vs yesterday (RM 7,614)</span>
                </div>
              </div>
              {/* Chart icon block */}
              <div className="flex-shrink-0 flex items-end gap-1" style={{ height: 48 }}>
                {[0.6, 0.9, 0.5, 0.8, 0.4, 0.75, 0.95].map((h, i) => (
                  <div
                    key={i}
                    className="w-1.5 rounded-t-sm"
                    style={{ height: `${h * 100}%`, background: i === 6 ? '#f97316' : 'rgba(255,255,255,0.2)' }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* ── Slide 2: Business Breakdown ── */}
          <div className="flex-shrink-0" style={{ width: '50%' }}>
            <div className="grid grid-cols-2 gap-3">
              {/* Bento card */}
              <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div className="text-xs text-slate-400 mb-2">Bento</div>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                  <span className="text-xs text-orange-400 font-medium">In Progress</span>
                </div>
                <div className="text-white font-bold text-lg">{bentoOrders} Orders</div>
                <div className="text-xs text-slate-400 mt-0.5">RM {revenueBento.toLocaleString()} Revenue</div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 bg-white/10 rounded-full h-1">
                    <div className="h-1 rounded-full bg-orange-400" style={{ width: `${bentoPercent}%` }} />
                  </div>
                  <span className="text-xs text-slate-400">{bentoPercent}%</span>
                </div>
              </div>
              {/* Dine-in card */}
              <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div className="text-xs text-slate-400 mb-2">Dine-in</div>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  <span className="text-xs text-green-400 font-medium">Open</span>
                </div>
                <div className="text-white font-bold text-lg">42 Orders</div>
                <div className="text-xs text-slate-400 mt-0.5">RM {revenueDineIn.toLocaleString()} Revenue</div>
                <div className="text-xs text-slate-400 mt-2">RM {dineInAvg} Avg Ticket</div>
              </div>
            </div>
          </div>
        </div>

        {/* Status badge — fixed overlay on slide 1 */}
        <div
          className="absolute top-5 right-5 transition-opacity"
          style={{ opacity: slide === 0 ? 1 : 0, transitionDuration: '0.2s' }}
        >
          <span className="text-[10px] font-semibold text-white px-2.5 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }}>
            Open
          </span>
        </div>
      </div>

      {/* Page indicators */}
      <div className="flex items-center justify-center gap-1.5 pb-3">
        <button
          onClick={() => goTo(0)}
          className="rounded-full transition-all"
          style={{
            width: slide === 0 ? 16 : 6,
            height: 6,
            background: slide === 0 ? '#f97316' : 'rgba(255,255,255,0.25)',
          }}
        />
        <button
          onClick={() => goTo(1)}
          className="rounded-full transition-all"
          style={{
            width: slide === 1 ? 16 : 6,
            height: 6,
            background: slide === 1 ? '#f97316' : 'rgba(255,255,255,0.25)',
          }}
        />
      </div>
    </div>
  )
}
