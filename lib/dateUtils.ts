// All date helpers use LOCAL time to avoid UTC offset issues (e.g. UTC+8)

export function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayLocalStr(): string {
  return toLocalDateStr(new Date())
}

/** True only for a real "YYYY-MM-DD" calendar date (local), e.g. rejects
 *  "2026-13-45" and malformed input. Used to validate untrusted query params. */
export function isValidDateStr(s: string | null | undefined): s is string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(s + 'T00:00:00')
  return !Number.isNaN(d.getTime()) && toLocalDateStr(d) === s
}

export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return toLocalDateStr(d)
}

export function getMondayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return toLocalDateStr(d)
}
