// ── Purchase Ledger CSV Export ──
// Pure function. Builds an Excel-friendly CSV (UTF-8 BOM, CRLF line endings)
// with the full column set. Owner-only access is enforced at the route layer.

import type { PurchaseRecord } from './types'

export const CSV_HEADERS = [
  'Date',
  'Item Name',
  'Specification',
  'Quantity',
  'Unit',
  'Unit Price',
  'Total Price',
  'Category',
  'Supplier',
  'Purchaser',
  'Receiver',
  'Remarks',
] as const

function escapeCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const BOM = '﻿'

export function recordsToCsv(records: PurchaseRecord[]): string {
  const rows: string[] = [CSV_HEADERS.join(',')]
  for (const r of records) {
    rows.push(
      [
        r.date,
        r.name,
        r.specification,
        r.quantity,
        r.unit,
        r.unit_price,
        r.total_price,
        r.category,
        r.supplier,
        r.purchaser,
        r.receiver,
        r.note,
      ]
        .map(escapeCell)
        .join(','),
    )
  }
  // UTF-8 BOM so Excel reads non-ASCII (e.g. supplier names) correctly.
  return BOM + rows.join('\r\n')
}

/** A safe download filename, e.g. wenxin-purchases-2026-06-16.csv */
export function csvFilename(today: string): string {
  return `wenxin-purchases-${today}.csv`
}
