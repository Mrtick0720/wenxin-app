/**
 * Format a growth percentage into a display string — the single source of truth
 * for rendering Growth anywhere in the UI. Never render a raw growthPercent.
 *
 * - null / undefined / NaN → "—" (no valid baseline).
 * - Otherwise a signed, one-decimal string, e.g. "-81.2%" or "+25.0%".
 *
 * One decimal place matches the format already used across the app. Uses
 * toFixed (not toLocaleString), so rounding and the "." separator are
 * locale-independent and identical on every browser, including iOS Safari.
 */
export function formatGrowthPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}
