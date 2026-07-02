export type BentoPaymentOrder = {
  id: number
  amount: number | null
}

export type BentoPaymentUpdate = {
  id: number
  paid: true
  payment_status: 'paid'
  amount_paid: number
}

export function buildBentoPaymentUpdates(orders: BentoPaymentOrder[]): BentoPaymentUpdate[] {
  return orders.map(order => ({
    id: order.id,
    paid: true,
    payment_status: 'paid',
    amount_paid: Number(order.amount || 0),
  }))
}
