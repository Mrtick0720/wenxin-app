// Derive the "My Today's Shift" home-card view from a staff_shifts row.
// Shared by the main Home and the Kitchen Home so both render identically.

import type { ShiftType } from './types'

export type ShiftViewState = 'on_duty' | 'off' | 'leave'

export type ShiftView = {
  state: ShiftViewState
  // Working window label, e.g. "08:30 - 17:30". Null on off / leave days.
  timeLabel: string | null
  // 0–100, how far through the working window we are right now.
  progressPercent: number
}

// Default working windows when a shift has no custom time label.
const DEFAULT_SHIFT_TIMES: Record<ShiftType, string | null> = {
  morning: '08:00 - 14:00',
  full_day: '08:30 - 17:30',
  afternoon: '14:00 - 21:00',
  off: null,
  leave: null,
}

function parseShiftRange(label: string): [number, number] | null {
  const m = label.match(/(\d{1,2}):(\d{2})\D+(\d{1,2}):(\d{2})/)
  if (!m) return null
  return [Number(m[1]) * 60 + Number(m[2]), Number(m[3]) * 60 + Number(m[4])]
}

export function buildShiftView(
  shift: { shiftType: ShiftType; shiftLabel: string } | null,
  now: Date,
): ShiftView {
  if (!shift || shift.shiftType === 'off') {
    return { state: 'off', timeLabel: null, progressPercent: 0 }
  }
  if (shift.shiftType === 'leave') {
    return { state: 'leave', timeLabel: null, progressPercent: 0 }
  }
  const raw = shift.shiftLabel?.trim() || DEFAULT_SHIFT_TIMES[shift.shiftType]
  const timeLabel = raw ? raw.replace(/\s*[–—-]\s*/, ' - ') : null
  let progressPercent = 0
  const range = timeLabel ? parseShiftRange(timeLabel) : null
  if (range) {
    const [start, end] = range
    const mins = now.getHours() * 60 + now.getMinutes()
    progressPercent = end > start ? ((mins - start) / (end - start)) * 100 : 0
  }
  return { state: 'on_duty', timeLabel, progressPercent }
}
