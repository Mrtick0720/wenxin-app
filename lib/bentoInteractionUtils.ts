type PanelMode = 'open' | 'close'
type PanelAction = 'open' | 'close' | 'reset-open' | 'reset-closed' | 'none'
type GestureAxis = 'h' | 'v' | null

export function shouldShowBentoTodayShortcut(selectedDate: string, today: string, detailOpen: boolean) {
  return selectedDate !== today && !detailOpen
}

export function getBentoSwipeThreshold(width: number) {
  return Math.round(Math.min(44, Math.max(32, width * 0.092)))
}

export function getBentoGestureAxis({ dx, dy }: { dx: number; dy: number }): GestureAxis {
  const absX = Math.abs(dx)
  const absY = Math.abs(dy)
  if (absX < 8 && absY < 8) return null
  return absX >= absY * 0.65 ? 'h' : 'v'
}

export function getBentoCloseGestureAxis({ dx, dy }: { dx: number; dy: number }): GestureAxis {
  const absX = Math.abs(dx)
  const absY = Math.abs(dy)
  if (absX < 10 && absY < 10) return null
  return absX >= absY * 1.25 ? 'h' : 'v'
}

export function getBentoPanelAction({
  dx,
  dy,
  threshold,
  mode,
}: {
  dx: number
  dy: number
  threshold: number
  mode: PanelMode
}): PanelAction {
  const axis = mode === 'close'
    ? getBentoCloseGestureAxis({ dx, dy })
    : getBentoGestureAxis({ dx, dy })
  if (axis !== 'h') return 'none'

  if (mode === 'open') {
    if (dx < -threshold) return 'open'
    if (dx < 0) return 'reset-closed'
    return 'none'
  }

  if (dx > threshold) return 'close'
  return 'reset-open'
}

export function getBentoPullState({ dy, threshold }: { dy: number; threshold: number }) {
  const offset = dy >= 0
    ? Math.min(Math.round(dy * 0.8), threshold + 22)
    : Math.max(Math.round(dy * 0.28), -24)

  return {
    offset,
    shouldRefresh: dy >= threshold,
  }
}
