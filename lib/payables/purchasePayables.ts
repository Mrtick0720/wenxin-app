export type PurchasePayableRow = {
  id: number
  supplier: string | null
  name: string
  total_price: number | null
  payment_status: string | null
  date: string
  note: string | null
  created_at: string
}

export type PayableProjection = {
  id: number
  supplier_name: string
  original_amount: number
  paid_amount: number
  balance: number
  due_date: string | null
  status: 'outstanding' | 'paid'
  notes: string | null
  created_at: string
}

export function isPaidPaymentStatus(status: string | null): boolean {
  return status?.trim().toLowerCase() === 'paid'
}

export function purchaseRowToPayable(row: PurchasePayableRow): PayableProjection {
  const total = Number(row.total_price ?? 0)
  const paid = isPaidPaymentStatus(row.payment_status)

  return {
    id: row.id,
    supplier_name: row.supplier || row.name || 'Unknown',
    original_amount: total,
    paid_amount: paid ? total : 0,
    balance: paid ? 0 : total,
    due_date: row.date,
    status: paid ? 'paid' : 'outstanding',
    notes: row.note,
    created_at: row.created_at,
  }
}

export function summarizePurchasePayables(
  rows: PurchasePayableRow[],
  today: string,
): { totalBalance: number; dueTodayCount: number } {
  const outstanding = rows.filter((row) => !isPaidPaymentStatus(row.payment_status))
  return {
    totalBalance: outstanding.reduce(
      (sum, row) => sum + Number(row.total_price ?? 0),
      0,
    ),
    dueTodayCount: outstanding.filter((row) => row.date === today).length,
  }
}
