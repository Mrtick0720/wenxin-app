'use client'

import { useState, useRef, useEffect } from 'react'

interface PullToRefreshProps {
  children: React.ReactNode
  onRefresh: () => Promise<void>
}

const MIN_SWIPE = 8   // minimum px before classifying gesture direction
const THRESHOLD = 60  // pull distance to trigger refresh

export default function PullToRefresh({ children, onRefresh }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startXRef = useRef(0)
  const startYRef = useRef(0)
  const trackingRef = useRef(false)
  const pullingRef = useRef(false)
  const axisRef = useRef<'h' | 'v' | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Stabilise onRefresh so the effect doesn't re-bind on every parent render
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 1) return
      startXRef.current = e.touches[0].clientX
      startYRef.current = e.touches[0].clientY
      trackingRef.current = true
      pullingRef.current = false
      axisRef.current = null
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!trackingRef.current || refreshing) return

      const dx = e.touches[0].clientX - startXRef.current
      const dy = e.touches[0].clientY - startYRef.current

      // Classify direction after crossing the minimum movement threshold
      if (axisRef.current === null) {
        if (Math.abs(dx) < MIN_SWIPE && Math.abs(dy) < MIN_SWIPE) return
        axisRef.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
      }

      // Horizontal gesture — let it pass through without interference
      if (axisRef.current === 'h') return

      // Vertical gesture — only take control for downward pulls at page top
      if (dy <= 0 || window.scrollY > 1) return

      // All conditions met: enter pulling state
      pullingRef.current = true
      e.preventDefault()
      setPullDistance(Math.min(dy * 0.45, THRESHOLD + 30))
    }

    const onTouchEnd = async () => {
      const wasPulling = pullingRef.current
      const dist = pullDistance

      // Reset ALL gesture state — nothing leaks into the next interaction
      trackingRef.current = false
      pullingRef.current = false
      axisRef.current = null
      startXRef.current = 0
      startYRef.current = 0

      if (wasPulling && dist >= THRESHOLD && !refreshing) {
        setRefreshing(true)
        setPullDistance(THRESHOLD)
        await onRefreshRef.current()
        setRefreshing(false)
      }
      setPullDistance(0)
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [pullDistance, refreshing]) // onRefresh stable via ref — no dependency churn

  const showIndicator = pullDistance > 5 || refreshing
  const indicatorHeight = refreshing ? THRESHOLD : pullDistance

  return (
    <div ref={containerRef} style={{ overflowX: 'hidden' }}>
      <div
        style={{
          height: indicatorHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: refreshing || pullDistance === 0 ? 'height 0.3s ease' : 'none',
          overflow: 'hidden',
        }}
      >
        {showIndicator && (
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              border: '2.5px solid #f97316',
              borderTopColor: 'transparent',
              animation: refreshing ? 'ptr-spin 0.7s linear infinite' : 'none',
              transform: !refreshing ? `rotate(${(pullDistance / THRESHOLD) * 300}deg)` : undefined,
              transition: !refreshing ? 'none' : undefined,
            }}
          />
        )}
      </div>

      <style>{`
        @keyframes ptr-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {children}
    </div>
  )
}
