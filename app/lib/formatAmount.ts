/**
 * Format a numeric amount into a display string.
 *
 * When `hidden` is true, returns "RM *****".
 * When `hidden` is false and `value` is not null, returns the value formatted
 * with comma separators (e.g. "RM 1,234.00").
 * When `value` is null, returns "—".
 */
export function formatAmount(value: number | null, hidden: boolean): string {
  if (value === null) return '—'
  if (hidden) return 'RM *****'
  return `RM ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
