export type CustomerOrderForUsage = {
  customer_name?: string | null
  date: string
  quantity?: number | null
  status: string
}

/**
 * Sum delivered portions for one customer's current package only.
 * Historical orders before the package start and future/cancelled orders do not
 * consume the current balance.
 */
export function getCurrentPackageUsage(
  orders: CustomerOrderForUsage[],
  customerName: string,
  packageStart: string,
  today: string,
): number {
  const normalizedName = customerName.trim().toLowerCase()

  return orders
    .filter(order =>
      order.customer_name?.trim().toLowerCase() === normalizedName
      && order.status !== 'canceled'
      && order.date >= packageStart
      && order.date <= today,
    )
    .reduce((sum, order) => sum + (order.quantity ?? 1), 0)
}
