type PanelMode = 'open' | 'close'
type PanelAction = 'open' | 'close' | 'reset-open' | 'reset-closed' | 'none'
type GestureAxis = 'h' | 'v' | null

export function shouldShowBentoTodayShortcut(selectedDate: string, today: string, detailOpen: boolean) {
  return selectedDate !== today && !detailOpen
}

export function getBentoSwipeThreshold(width: number) {
  return Math.round(Math.min(56, Math.max(44, width * 0.12)))
}

export function getBentoGestureAxis({ dx, dy }: { dx: number; dy: number }): GestureAxis {
  const absX = Math.abs(dx)
  const absY = Math.abs(dy)
  if (absX < 8 && absY < 8) return null
  return absX >= absY * 0.65 ? 'h' : 'v'
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
  if (getBentoGestureAxis({ dx, dy }) !== 'h') return 'none'

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
