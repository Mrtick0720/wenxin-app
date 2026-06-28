// Cash Drawer status card for the front-desk Home.
//
// PERMISSION-GATED: the caller only renders this when the user holds the
// cashier:view permission (canViewCashier). It shows operational cash-drawer
// state — never owner/manager financials (revenue, receivables, payables…).

import NavLink from '../NavLink'

export type CashDrawerState = 'open' | 'closed' | 'none'

const STATE_CONFIG: Record<CashDrawerState, { label: string; dot: string; text: string }> = {
  open:   { label: 'Open',          dot: 'bg-green-500', text: 'text-green-600' },
  closed: { label: 'Closed',        dot: 'bg-gray-400',  text: 'text-gray-500' },
  none:   { label: 'Not opened yet', dot: 'bg-gray-300', text: 'text-gray-400' },
}

interface FrontDeskCashCardProps {
  state: CashDrawerState
  /** Current drawer amount (RM), or null when unknown / not yet opened. */
  amount: number | null
}

export default function FrontDeskCashCard({ state, amount }: FrontDeskCashCardProps) {
  const cfg = STATE_CONFIG[state]
  return (
    <NavLink href="/cashier" className="bg-white rounded-2xl shadow-sm px-4 py-3 block active:opacity-80">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-gray-500">Cash Drawer</span>
        <span className={`flex items-center gap-1.5 text-xs font-medium ${cfg.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full inline-block ${cfg.dot}`} />
          {cfg.label}
        </span>
      </div>
      <div className="mt-1 text-2xl font-bold text-gray-900 leading-tight">
        {amount !== null ? `RM ${amount.toLocaleString()}` : '—'}
      </div>
      <div className="text-[11px] text-gray-400 mt-0.5">Cash on hand</div>
    </NavLink>
  )
}
