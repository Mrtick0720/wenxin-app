import NavLink from '../NavLink'

interface BentoOpsCardProps {
  orders: number
  revenue: number
  percent: number
  showRevenue: boolean
}

export default function BentoOpsCard({ orders, revenue, percent, showRevenue }: BentoOpsCardProps) {
  return (
    <NavLink href="/bento" className="bg-white rounded-2xl p-4 shadow-sm block">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-800">Bento Operations</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1Z"/>
          <path d="M6 17h12"/>
        </svg>
      </div>
      <div className={`grid ${showRevenue ? 'grid-cols-2' : 'grid-cols-1'} gap-2 mb-3`}>
        <div>
          <div className="text-3xl font-bold text-blue-600 leading-none">{orders}</div>
          <div className="text-xs text-gray-500 mt-1.5">Orders</div>
        </div>
        {showRevenue && (
          <div>
            <div className="text-3xl font-bold text-blue-600 leading-none">RM {revenue.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1.5">Revenue</div>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-gray-500">Completion Rate</span>
        <span className="text-sm font-bold text-gray-900">{percent}%</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full bg-blue-600" style={{ width: `${percent}%` }} />
      </div>
    </NavLink>
  )
}
