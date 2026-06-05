type PanelMode = 'open' | 'close'
type PanelAction = 'open' | 'close' | 'reset-open' | 'reset-closed' | 'none'

export function shouldShowBentoTodayShortcut(selectedDate: string, today: string, detailOpen: boolean) {
  return selectedDate !== today && !detailOpen
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
  if (Math.abs(dx) <= Math.abs(dy) || Math.abs(dx) < 8) return 'none'

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
