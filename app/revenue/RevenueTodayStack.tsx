'use client'

import BackButton from '../components/BackButton'
import { businessToday } from '@/lib/feedme/parseQueryResult'
import type { FeedMeDailyRevenue } from '@/lib/feedme/liveDailySales'

interface Props {
  data: FeedMeDailyRevenue
}

export default function RevenueTodayStack({ data }: Props) {
  const v = data.value
  const isLive = data.source === 'live'
  const isToday = v.date === businessToday()

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f9fafb' }}>
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center gap-3 border-b" style={{ flexShrink: 0 }}>
        <BackButton href="/" />
        <span className="font-semibold text-base">Today Revenue Detail</span>
        {isLive && (
          <span className="ml-auto flex items-center gap-1 text-xs text-green-500">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            Live
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)' }}>
        <div className="px-4 py-4 pb-8 space-y-4">
          {/* Primary KPI card */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm text-gray-500">
                {isToday ? "Today's Revenue" : `Revenue for ${v.date}`}
              </div>
              {!isToday && (
                <span className="text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">
                  Prior Day
                </span>
              )}
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">
              RM {v.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-gray-400">
              {v.date} · {isToday ? 'Today' : 'Last completed business day'}
            </div>
          </div>

          {/* Breakdown grid */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="text-sm font-semibold text-gray-700 mb-3">Breakdown</div>
            <div className="grid grid-cols-2 gap-y-4 gap-x-4">
              <div>
                <div className="text-xs text-gray-400">Gross Sales</div>
                <div className="text-lg font-semibold text-gray-900">
                  RM {v.gross.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Service Charge</div>
                <div className="text-lg font-semibold text-gray-900">
                  RM {v.serviceCharge.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Rounding</div>
                <div className="text-lg font-semibold text-gray-900">
                  RM {v.rounding.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Net Revenue</div>
                <div className="text-lg font-semibold text-green-600">
                  RM {v.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>

          {/* Volume metrics */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="text-sm font-semibold text-gray-700 mb-3">Volume</div>
            <div className="flex gap-8">
              <div>
                <div className="text-xs text-gray-400">Quantity</div>
                <div className="text-xl font-bold text-gray-900">{v.qty.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Pax</div>
                <div className="text-xl font-bold text-gray-900">{v.pax.toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* Payment breakdown */}
          {v.payments.length > 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="text-sm font-semibold text-gray-700 mb-3">Payment Methods</div>
              <div className="space-y-2">
                {v.payments.map((p) => (
                  <div key={p.method} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700">{p.method}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">{p.percentage}%</span>
                      <span className="text-sm font-medium text-gray-900">
                        RM {p.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Source note */}
          <div className="bg-blue-50 rounded-2xl p-4">
            <div className="text-xs text-blue-500">
              {isLive
                ? 'Live data from FeedMe POS. Refreshes every 3 minutes.'
                : `Cached data from ${new Date(data.fetchedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}. Live FeedMe is currently unavailable.`}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
