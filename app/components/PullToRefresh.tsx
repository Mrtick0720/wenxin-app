'use client'

import { useState, useRef, useCallback } from 'react'

interface PullToRefreshProps {
  children: React.ReactNode
  onRefresh: () => Promise<void>
}

export default function PullToRefresh({ children, onRefresh }: PullToRefreshProps) {
  const [pulling, setPulling] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const startY = useRef(0)
  const threshold = 50

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      startY.current = e.touches[0].clientY
    }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (refreshing) return
    const currentY = e.touches[0].clientY
    const distance = currentY - startY.current
    if (distance > 0 && window.scrollY === 0) {
      setPulling(true)
      setPullDistance(Math.min(distance * 0.4, threshold + 20))
    }
  }, [refreshing])

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance >= threshold && !refreshing) {
      setRefreshing(true)
      setPullDistance(50)
      await onRefresh()
      setRefreshing(false)
    }
    setPulling(false)
    setPullDistance(0)
  }, [pullDistance, refreshing, onRefresh])

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ position: 'relative' }}
    >
      {/* 下拉刷新指示器 */}
      <div
        style={{
          height: pullDistance || (refreshing ? 50 : 0),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          transition: pulling ? 'none' : 'height 0.3s ease',
        }}
      >
        {(pulling || refreshing) && (
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: '2.5px solid #f97316',
              borderTopColor: 'transparent',
              animation: refreshing ? 'spin 0.8s linear infinite' : 'none',
              transform: pulling && !refreshing ? `rotate(${(pullDistance / threshold) * 360}deg)` : undefined,
            }}
          />
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {children}
    </div>
  )
}
