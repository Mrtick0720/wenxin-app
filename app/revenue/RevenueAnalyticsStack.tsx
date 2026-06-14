'use client'

import BackButton from '../components/BackButton'
import { businessToday } from '@/lib/feedme/parseQueryResult'
import type { FeedMeMtdSummary, FeedMe7DaySummary } from '@/lib/feedme/liveDailySales'

interface Props {
  mtd: FeedMeMtdSummary | null
  week: FeedMe7DaySummary | null
}

export default function RevenueAnalyticsStack({ mtd, week }: Props) {
  const monthLabel = mtd
    ? new Date(mtd.monthStart + 'T00:00:00+08:00').toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : null

  const today = businessToday()

  const fmt = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f9fafb' }}>
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center gap-3 border-b" style={{ flexShrink: 0 }}>
        <BackButton href="/" />
        <span className="font-semibold text-base">Revenue Analytics</span>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)' }}>
        <div className="px-4 py-4 pb-8 space-y-4">
          {/* MTD Revenue card */}
          {mtd && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="text-sm text-gray-500 mb-1">{monthLabel}</div>
              <div className="text-3xl font-bold text-gray-900 mb-1">
                RM {Math.floor(mtd.mtdRevenue).toLocaleString('en-US')}
              </div>
              <div className="text-xs text-gray-400">
                Month-to-Date · as of {mtd.asOf}
              </div>
            </div>
          )}

          {/* MTD Performance */}
          {mtd && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="text-sm font-semibold text-gray-700 mb-3">MTD Performance</div>
              <div className="flex gap-8">
                <div>
                  <div className="text-xs text-gray-400">Avg Daily</div>
                  <div className="text-xl font-bold text-gray-900">
                    RM {Math.floor(mtd.mtdAverage).toLocaleString('en-US')}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    over {mtd.operatingDays} operating day{mtd.operatingDays !== 1 ? 's' : ''}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Best Day</div>
                  <div className="text-xl font-bold text-gray-900">
                    RM {Math.floor(mtd.bestDayRevenue).toLocaleString('en-US')}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 7-Day Revenue */}
          {week && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm text-gray-500">7-Day Revenue</div>
                <div className="text-xs text-gray-400">
                  {week.startDate} → {week.endDate}
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">
                RM {Math.floor(week.totalRevenue).toLocaleString('en-US')}
              </div>
              <div className="text-xs text-gray-400">
                over {week.operatingDays} operating day{week.operatingDays !== 1 ? 's' : ''}
              </div>
            </div>
          )}

          {/* 7-Day Performance */}
          {week && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="text-sm font-semibold text-gray-700 mb-3">7-Day Performance</div>
              <div className="grid grid-cols-2 gap-y-4 gap-x-4">
                <div>
                  <div className="text-xs text-gray-400">7-Day Avg</div>
                  <div className="text-xl font-bold text-gray-900">
                    RM {Math.floor(week.avgDaily).toLocaleString('en-US')}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Operating Days</div>
                  <div className="text-xl font-bold text-gray-900">{week.operatingDays}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Best Day</div>
                  <div className="text-lg font-semibold text-green-600">
                    RM {fmt(week.bestDay.revenue)}
                  </div>
                  <div className="text-xs text-gray-400">{week.bestDay.date}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Worst Day</div>
                  <div className="text-lg font-semibold text-amber-600">
                    RM {fmt(week.worstDay.revenue)}
                  </div>
                  <div className="text-xs text-gray-400">{week.worstDay.date}</div>
                </div>
              </div>
            </div>
          )}

          {/* Daily Revenue List */}
          {week && week.dailyList.length > 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="text-sm font-semibold text-gray-700 mb-3">Daily Breakdown</div>
              <div className="space-y-0">
                {week.dailyList.map((day) => {
                  const isToday = day.date === today
                  const noSales = day.revenue === 0
                  return (
                    <div
                      key={day.date}
                      className={`flex items-center justify-between py-2.5 border-b border-gray-50 last:border-b-0 ${
                        noSales ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium text-gray-800">{day.date}</span>
                        {isToday && noSales && (
                          <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full flex-shrink-0">
                            Not opened
                          </span>
                        )}
                        {isToday && !noSales && (
                          <span className="text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full flex-shrink-0">
                            Today
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-xs text-gray-400">{day.qty} qty</span>
                        <span className="text-sm font-semibold text-gray-900 w-24 text-right">
                          {noSales ? 'RM 0' : `RM ${fmt(day.revenue)}`}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Summary stats */}
          {mtd && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="text-sm font-semibold text-gray-700 mb-3">Summary</div>
              <div className="grid grid-cols-2 gap-y-4 gap-x-4">
                <div>
                  <div className="text-xs text-gray-400">Period Start</div>
                  <div className="text-base font-medium text-gray-900">{mtd.monthStart}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Data As Of</div>
                  <div className="text-base font-medium text-gray-900">{mtd.asOf}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Total MTD Revenue</div>
                  <div className="text-base font-medium text-gray-900">
                    RM {mtd.mtdRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Operating Days</div>
                  <div className="text-base font-medium text-gray-900">{mtd.operatingDays}</div>
                </div>
              </div>
            </div>
          )}

          {/* Source note */}
          <div className="bg-blue-50 rounded-2xl p-4">
            <div className="text-xs text-blue-500">
              Data sourced from FeedMe POS daily sales range.
              {mtd && <> MTD: {mtd.monthStart} → {mtd.asOf}.</>}
              {week && <> 7-day: {week.startDate} → {week.endDate}.</>}
              {' '}Refreshes every 3 minutes.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
