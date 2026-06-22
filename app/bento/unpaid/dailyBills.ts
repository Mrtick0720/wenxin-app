export type UnpaidOrder = {
  id: number
  customer_name: string
  date: string
  amount: number
  paid: boolean
  status: string
  phone?: string | null
  address?: string | null
  area?: string | null
  menu_type?: string | null
  items?: string | null
  note?: string | null
  quantity?: number | null
}

export type DailyBill = {
  key: string
  customerName: string
  date: string
  total: number
  orderCount: number
  orderIds: number[]
  orders: UnpaidOrder[]
}

export type CustomerBills = {
  key: string
  customerName: string
  phone: string | null
  total: number
  bills: DailyBill[]
}

function customerKey(name: string): string {
  return name.trim().toLocaleLowerCase('en')
}

export function groupUnpaidOrdersByCustomerAndDate(
  orders: UnpaidOrder[],
): CustomerBills[] {
  const customers = new Map<
    string,
    {
      key: string
      customerName: string
      phone: string | null
      ordersByDate: Map<string, UnpaidOrder[]>
    }
  >()

  for (const order of orders) {
    if (order.paid || order.status === 'canceled') continue

    const displayName = order.customer_name.trim() || 'Unknown'
    const key = customerKey(displayName)
    const customer = customers.get(key) ?? {
      key,
      customerName: displayName,
      phone: order.phone?.trim() || null,
      ordersByDate: new Map<string, UnpaidOrder[]>(),
    }
    const dailyOrders = customer.ordersByDate.get(order.date) ?? []
    dailyOrders.push(order)
    customer.ordersByDate.set(order.date, dailyOrders)
    customers.set(key, customer)
  }

  return Array.from(customers.values())
    .map((customer): CustomerBills => {
      const bills = Array.from(customer.ordersByDate.entries())
        .map(([date, dailyOrders]): DailyBill => {
          const total = dailyOrders.reduce(
            (sum, order) => sum + Number(order.amount || 0),
            0,
          )
          return {
            key: `${customer.key}:${date}`,
            customerName: customer.customerName,
            date,
            total,
            orderCount: dailyOrders.length,
            orderIds: dailyOrders.map((order) => order.id),
            orders: dailyOrders,
          }
        })
        .sort((a, b) => b.date.localeCompare(a.date))

      return {
        key: customer.key,
        customerName: customer.customerName,
        phone: customer.phone,
        total: bills.reduce((sum, bill) => sum + bill.total, 0),
        bills,
      }
    })
    .sort((a, b) => b.total - a.total || a.customerName.localeCompare(b.customerName))
}
