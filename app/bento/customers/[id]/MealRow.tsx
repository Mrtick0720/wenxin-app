// Shared meal/delivery row used by the customer detail page (Scheduled Meals +
// recent Delivery History) and the full Delivery History page, so they stay
// visually identical.
export type MealRowOrder = {
  id: number
  date: string
  menu_type: string
  quantity?: number
  status: string
  amount: number
  // True when the meal is delivered by the used-portions count even though the
  // order row itself was never explicitly marked completed.
  delivered?: boolean
}

export default function MealRow({ order }: { order: MealRowOrder }) {
  const badge =
    order.status === 'canceled' ? { label: 'Skipped', cls: 'bg-gray-100 text-gray-500' } :
    (order.delivered || order.status === 'completed') ? { label: 'Done', cls: 'bg-green-50 text-green-500' } :
    { label: 'Pending', cls: 'bg-orange-50 text-orange-500' }

  return (
    <div className="bg-white rounded-xl px-4 py-3 shadow-sm flex items-center justify-between">
      <div>
        <div className="text-sm font-medium text-gray-800">{order.date}</div>
        <div className="text-xs text-gray-400 mt-0.5">
          {order.menu_type}{(order.quantity ?? 1) > 1 ? ` ×${order.quantity}` : ''}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-xs px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
        <span className="text-sm font-medium text-gray-700">RM {order.amount}</span>
      </div>
    </div>
  )
}
