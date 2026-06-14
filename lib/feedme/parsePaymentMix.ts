// FeedMe payment-mix parser (proof-of-concept).
//
// Parses the payment breakdown from a captured FeedMe Daily Sales response IF it
// carries one. Returns [] when no payment data was captured — it never invents
// methods, amounts, or percentages. Not displayed yet; only prepares the adapter.
//
// Mapping (per the captured FeedMe response shape):
//   Method -> method
//   Amount -> amount
//   percentage is computed as amount / total.

export interface FeedMePaymentRow {
  Method: string
  Amount: number
}

export interface PaymentBreakdown {
  method: string
  amount: number
  percentage: number
}

export function parsePaymentMix(
  payments: FeedMePaymentRow[] | undefined | null,
): PaymentBreakdown[] {
  if (!payments || payments.length === 0) return []

  const total = payments.reduce((sum, p) => sum + p.Amount, 0)
  if (total <= 0) return []

  return payments.map((p) => ({
    method: p.Method,
    amount: p.Amount,
    percentage: Number(((p.Amount / total) * 100).toFixed(1)),
  }))
}
