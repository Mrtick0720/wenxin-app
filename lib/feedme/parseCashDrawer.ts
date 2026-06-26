// Parser for the FeedMe Cash Drawer postgres-query response.
//
// The Cash Drawer response has three result sets identified by their column
// schema names: RECORD (session info), DRAWER (pay-in / pay-out movements),
// and PAYMENT_TIME_PAYMENT (payment method breakdown). All three sets share a
// Counter ID dimension that is used as the join key across sets.
//
// This module is pure (no I/O) — it accepts the raw parsed JSON and returns
// one ParsedCashDrawerSession per counter.

import type { FeedMeQueryResultSet, FeedMeQueryColumn, FeedMeQueryRow } from './parseQueryResult'

export interface ParsedCashDrawerSession {
  counter: string
  counterId: string
  outletName: string | null
  openTime: string | null      // ISO 8601
  closeTime: string | null
  openedBy: string | null
  closedBy: string | null
  openingFloat: number | null
  closingFloat: number | null
  cashSales: number | null
  payIn: number | null
  payOut: number | null
  alipay: number | null
  duitnow: number | null
  maybankQr: number | null
  touchngo: number | null
  wechat: number | null
}

type PaymentField = 'cashSales' | 'alipay' | 'duitnow' | 'maybankQr' | 'touchngo' | 'wechat'

const PAYMENT_FIELD: Record<string, PaymentField> = {
  'CASH':       'cashSales',
  'ALI PAY':    'alipay',
  'DUIT NOW':   'duitnow',
  'MAYBANK QR': 'maybankQr',
  'TOUCH N GO': 'touchngo',
  'WE CHAT':    'wechat',
}

function labelToId(columns: FeedMeQueryColumn[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const c of columns) if (c.label) map.set(c.label, c.id)
  return map
}

function num(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function str(v: unknown): string {
  return v == null ? '' : String(v)
}

function isRollup(row: FeedMeQueryRow): boolean {
  return row.isRollup === true || row.value['_is_rollup'] === true
}

function hasSchema(set: FeedMeQueryResultSet, schema: string): boolean {
  return set.columns.some((c) => c.schema === schema)
}

function safeIso(s: string): string | null {
  if (!s) return null
  const d = new Date(s)
  return Number.isFinite(d.getTime()) ? d.toISOString() : null
}

type SessionAccum = Omit<ParsedCashDrawerSession, 'payIn' | 'payOut'> & {
  payIn: number
  payOut: number
}

export function parseCashDrawer(response: unknown): ParsedCashDrawerSession[] {
  const sets: FeedMeQueryResultSet[] = Array.isArray(response)
    ? (response as FeedMeQueryResultSet[])
    : []

  const recordSet  = sets.find((s) => hasSchema(s, 'RECORD'))
  const drawerSet  = sets.find((s) => hasSchema(s, 'DRAWER'))
  const paymentSet = sets.find((s) => hasSchema(s, 'PAYMENT_TIME_PAYMENT'))

  if (!recordSet) return []

  // Pass 1: build one session per counter from RECORD rows
  const sessions = new Map<string, SessionAccum>()
  {
    const ids   = labelToId(recordSet.columns)
    const ckCol = ids.get('Counter ID')
    if (!ckCol) return []

    for (const row of recordSet.rows) {
      if (isRollup(row)) continue
      const counterId = str(row.value[ckCol]).trim()
      if (!counterId) continue

      const cell = (label: string): unknown => {
        const id = ids.get(label)
        return id != null ? row.value[id] : undefined
      }

      sessions.set(counterId, {
        counterId,
        counter:       str(cell('Counter')).trim(),
        outletName:    str(cell('Name')).trim() || null,
        openTime:      safeIso(str(cell('Open time')).trim()),
        closeTime:     safeIso(str(cell('Close time')).trim()),
        openedBy:      str(cell('Open by')).trim()  || null,
        closedBy:      str(cell('Close by')).trim() || null,
        openingFloat:  cell('Open amount')  != null ? num(cell('Open amount'))  : null,
        closingFloat:  cell('Close amount') != null ? num(cell('Close amount')) : null,
        payIn:  0,
        payOut: 0,
        cashSales: null,
        alipay:    null,
        duitnow:   null,
        maybankQr: null,
        touchngo:  null,
        wechat:    null,
      })
    }
  }

  // Pass 2: accumulate pay-in / pay-out from DRAWER rows (Out is stored negative in FeedMe)
  if (drawerSet) {
    const ids   = labelToId(drawerSet.columns)
    const ckCol = ids.get('Counter ID')
    const inCol = ids.get('In')
    const outCol = ids.get('Out')
    if (ckCol) {
      for (const row of drawerSet.rows) {
        if (isRollup(row)) continue
        const counterId = str(row.value[ckCol]).trim()
        const session = sessions.get(counterId)
        if (!session) continue
        if (inCol)  session.payIn  += num(row.value[inCol])
        if (outCol) session.payOut += Math.abs(num(row.value[outCol]))
      }
    }
  }

  // Pass 3: accumulate payment amounts by method from PAYMENT_TIME_PAYMENT rows
  if (paymentSet) {
    const counterCol = paymentSet.columns.find((c) => c.label === 'Counter ID')
    const methodCol  = paymentSet.columns.find(
      (c) => c.fieldType === 'DIMENSION' && c.label === 'Payment',
    )
    const amountCol = paymentSet.columns.find((c) => c.fieldType === 'METRIC')

    if (counterCol && methodCol && amountCol) {
      for (const row of paymentSet.rows) {
        if (isRollup(row)) continue
        const counterId = str(row.value[counterCol.id]).trim()
        const session = sessions.get(counterId)
        if (!session) continue
        const method = str(row.value[methodCol.id]).trim().toUpperCase()
        const field  = PAYMENT_FIELD[method]
        if (!field) continue
        session[field] = (session[field] ?? 0) + num(row.value[amountCol.id])
      }
    }
  }

  return [...sessions.values()].map((s) => ({
    counter:      s.counter,
    counterId:    s.counterId,
    outletName:   s.outletName,
    openTime:     s.openTime,
    closeTime:    s.closeTime,
    openedBy:     s.openedBy,
    closedBy:     s.closedBy,
    openingFloat: s.openingFloat,
    closingFloat: s.closingFloat,
    cashSales:    s.cashSales,
    payIn:        drawerSet ? s.payIn  : null,
    payOut:       drawerSet ? s.payOut : null,
    alipay:       s.alipay,
    duitnow:      s.duitnow,
    maybankQr:    s.maybankQr,
    touchngo:     s.touchngo,
    wechat:       s.wechat,
  }))
}
