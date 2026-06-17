// ── Business-date helpers (Asia/Kuching, UTC+8) ──
// The restaurant is in Kota Kinabalu (Sabah, UTC+8). Business dates in
// `purchase_items.date` are local KK calendar dates. We compute "today" in
// Asia/Kuching explicitly so the module is correct regardless of the server's
// timezone (Vercel runs UTC), and so it agrees with the RLS `kk_today()` helper.

const KK_TZ = 'Asia/Kuching'

/** Today's KK calendar date as YYYY-MM-DD. */
export function businessToday(): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: KK_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/** Date string `n` days before `dateStr` (calendar arithmetic, TZ-safe). */
export function shiftDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + n)
  return dt.toISOString().slice(0, 10)
}

/** First day of the month for `dateStr` (YYYY-MM-01). */
export function monthStart(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`
}
